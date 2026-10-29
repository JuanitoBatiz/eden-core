# Fase 5 — Integración con Loyverse (POS)

> Fecha: 2026-10-25 · Solo lectura. **No se llamó a la API de Loyverse** (es el POS real); todo se dedujo del código y de la BD.
> Archivos: `src/lib/loyverse.ts` (441 líneas), `src/lib/loyalty.ts`, `src/app/api/webhooks/loyverse/route.ts`, `src/app/api/cron/{retry-loyverse-sync,sync-inventory}/route.ts`, `src/app/api/admin/sync-loyverse/route.ts`, `scripts/*loyverse*`.
> Los valores de secretos **no** se reproducen aquí.

## 🚨 0. Hallazgo crítico de seguridad (leer primero)

**El repositorio de GitHub `JuanitoBatiz/eden-core` es PÚBLICO** (`gh repo view` → `visibility: PUBLIC`) **y contiene credenciales reales hardcodeadas en archivos versionados:**

| Archivo | Qué contiene | ¿Es el valor vigente? |
|---|---|---|
| `scripts/recover-loyverse-orders.mjs` (commit `9c2d9`, 2026-08-08) | **Supabase `service_role` key**, **token de acceso de Loyverse**, store id, id de variante genérica y de tipo de pago; además **nombres, teléfonos y direcciones reales de clientes** | **Sí**: la `service_role` y el token son *idénticos* a los de `.env.local` (verificado por comparación, sin imprimirlos) |
| `scripts/diagnose-loyverse.mjs` (mismo commit) | Token de acceso de Loyverse | **Sí**, idéntico al actual |

Consecuencias: cualquier persona en internet puede (1) leer, modificar o borrar **toda** la base de datos de Supabase saltándose RLS (pedidos, teléfonos, direcciones, datos bancarios `bank_config`, roles de usuarios: podría hacerse owner), (2) usar la API de Loyverse (crear/anular recibos, ver ventas, clientes). Aunque se borren los archivos, **siguen en el historial de git**.

**Acciones recomendadas (las debe hacer el dueño/usted; no las ejecuté):**
1. **Rotar YA** la `service_role` key de Supabase (Project Settings → API) y el token de Loyverse (Back Office → Access tokens), actualizar Vercel y `.env.local`, y redesplegar.
2. Pasar el repo a **privado** de inmediato (si el cliente no necesita que sea público).
3. Después, eliminar los secretos del historial (`git filter-repo`/BFG) y borrar esos dos scripts; las llaves viejas ya deben estar invalidadas.
4. Dado que además `OWNER_SECRET_CODE`/`CASHIER_SECRET_CODE` no están en el repo (verificado), no hace falta rotarlos por esto; sí por H3.1/H3.2 si hay sospecha.
5. Revisar en Supabase (logs/Auth) y en Loyverse si hubo accesos no esperados desde 2026-08-08.

Mientras no se rote, **todo lo demás de este análisis es secundario**.

## 1. Mapa de la integración

```
Web (Next.js)  ───►  Loyverse API v1.0   (https://api.loyverse.com/v1.0)
   crea recibo      POST /receipts                 (al entrar a in_preparation)
   anula recibo     GET /receipts/{n} + POST /receipts/{n}/refund   (al cancelar)
   crea cliente     POST /customers                (al registrarse; con cola de reintento)
   lee puntos       GET  /customers/{id}           (lealtad)
   lee inventario   GET  /inventory               (cron – no programado)
   tipos de pago    GET  /payment_types            (cacheado en memoria)
Loyverse ───► Web   POST /api/webhooks/loyverse    (inventario, items, recibos anulados)
```
Configuración (solo nombres): `LOYVERSE_ACCESS_TOKEN`, `LOYVERSE_STORE_ID`, `LOYVERSE_GENERIC_VARIANT_ID`, `LOYVERSE_WEBHOOK_SECRET`. Si falta cualquiera de las tres primeras, **`isLoyverseConfigured` = false y TODO funciona en modo "MOCK"**: devuelve ids falsos (`loyverse_rec_…`, `T-####`) y *no avisa a nadie*; peligro en cualquier entorno donde falte una variable (los pedidos quedarían con recibos inventados).

## 2. Creación del recibo (`createLoyverseReceipt`)

Se invoca desde 4 sitios: `pay-physical`, `approve-payment`, `status` (→ `in_preparation`) y `sync-loyverse` (retroactivo).

- **Cada línea del pedido se envía con la variante genérica** (`variant_id = item.variantId || item.variant || LOYVERSE_GENERIC_VARIANT_ID`). Ningún ítem de `orders.items` trae `variantId`/`variant` (0 de 434 líneas revisadas) y **ningún producto tiene `loyverse_item_id`** (0 de 24). Resultado: **todas las ventas web aparecen en Loyverse como el mismo artículo genérico**; el nombre real del platillo y sus personalizaciones solo viajan en la nota de la línea (≤255 caracteres). Los reportes de ventas por producto/categoría/inventario del dueño en Loyverse **no reflejan lo vendido por la web**.
- Precio de línea = `item.price` (el que mandó el frontend), no `calculated_unit_price` (el del servidor). En 5 de los últimos 300 pedidos difieren. El pago enviado es `order.total` completo (productos + envío). Si no cuadran las sumas, Loyverse podría aceptar descuadres sin avisar.
- Envío: se agrega como línea extra "Costo de Envío a Domicilio" (variante genérica) solo si `delivery_fee > 0`.
- Pago: `transferencia/spei` → tipo de pago por nombre (con fallback "OTHER"), `tarjeta` → CARD, resto → efectivo (primer tipo CASH). **"Pagar en físico (efectivo/tarjeta)" siempre llega como `efectivo`**, aunque el cliente pague con tarjeta.
- La nota del recibo incluye tipo de servicio, dirección/maps, método, # de pedido (últimos 4 de la UUID), cliente y teléfono.
- **Identificador del recibo**: la API de Loyverse no devuelve `id`; el código guarda `receipt_number` (p. ej. "0031") **en ambas columnas** (`loyverse_receipt_id` y `loyverse_receipt_number`). Es la clave que se usa luego para anular. Depende de que el número sea único en la cuenta.
- **Fallos**: los 3 puntos de creación atrapan el error, lo escriben en consola y **continúan**; el pedido sigue su curso sin recibo. **No existe cola de reintento de recibos** (la tabla `loyverse_sync_queue` solo conoce `customer_create`). El único remedio es manual: `POST /api/admin/sync-loyverse` (owner) para pedidos `delivered` sin recibo, o los scripts sueltos.
- No hay idempotencia contra Loyverse (no se envía clave de idempotencia); el único guardián es `if (!order.loyverse_receipt_id)` leído antes (carrera H4.7 → posible recibo doble).

### 2.1 `sync-loyverse` (inyección retroactiva)
`POST /api/admin/sync-loyverse` crea recibos para todo pedido `delivered` sin recibo, **con método `efectivo`**, excluyendo clientes cuyo nombre empiece con "juan", o sea "jesús", "dueño", etc. (lista de nombres de prueba **hardcodeada**: un cliente real llamado "Juan …" nunca se sincronizaría). Su `GET` devuelve cuántos faltan y el monto. Hoy: 24 pedidos / ≈ $2 930 (varios históricos, algunos son cuentas de prueba).

## 3. Anulación / reembolso (`refundLoyverseReceipt`)
Se usa al cancelar desde `PATCH /orders/[id]/status` si el pedido tiene `loyverse_receipt_id`:
1. `GET /receipts/{id}` para obtener las líneas; 2. `POST /receipts/{id}/refund` con todas las líneas y cantidades.
- Es el **único** camino hacia Loyverse en una cancelación; ocurre **antes** de actualizar la BD (H4.2) y, si falla, la cancelación entera falla.
- **Para tu tarea:** cancelar/modificar antes de `in_preparation` **no llega aquí** (no hay recibo). Solo se usaría si más adelante se permitiera cancelar en cocina.
- Si el cajero anula manualmente en la app de Loyverse y luego cancela en la web, el `refund` devolverá error y la cancelación web quedará bloqueada (H4.2).

## 4. Webhook (`POST /api/webhooks/loyverse`)
- Verifica firma HMAC-SHA1 (`X-Loyverse-Signature`) **solo si** existe `LOYVERSE_WEBHOOK_SECRET`; la comparación no es de tiempo constante. Si el secreto no está definido en producción, el endpoint acepta cualquier POST sin firma.
- Registra el evento en `webhook_logs` y procesa "en segundo plano" (`processWebhookAsync(...)` sin `await`). **En Vercel (serverless) la ejecución puede cortarse en cuanto se responde 200**, por lo que ese procesamiento no es confiable (se necesitaría `waitUntil`/`after`).
- Eventos manejados: `inventory_levels.update` y `items.update` (disponibilidad de productos por `loyverse_item_id`) y `receipts.*` (anulaciones/devoluciones en el POS → cancela el pedido web).
- **`webhook_logs` tiene 0 filas** (Fase 2) ⇒ el webhook **nunca ha recibido una llamada válida** (no está configurado en Loyverse, o falla antes de insertar). Es decir, hoy la integración Loyverse → web **no funciona**: ni inventario, ni anulaciones.
- **Bug en el código:** al cancelar por anulación del POS escribe `cancel_reason` en `orders`, **columna que no existe en la tabla** (confirmado con el esquema real). Esa actualización falla y nadie lo nota (no se revisa el error). Además, como ningún producto tiene `loyverse_item_id`, ni inventario ni `items.update` actualizarían nada aunque llegaran eventos.
- ⚠ Pista útil: el código **ya espera** un campo `cancel_reason` en `orders`. Añadirlo (más `cancelled_at`, `cancelled_by`) para la cancelación de clientes sería coherente con lo que el webhook intenta hacer.

## 5. Clientes y lealtad
- Al verificar OTP, si el usuario no tiene `loyverse_customer_id`: se intenta crear el cliente en Loyverse (10 s de timeout); si falla se encola `customer_create`. Hay **16 trabajos pendientes con 0 intentos desde julio** porque el cron no corre (H2.6). Efecto: esos clientes se facturan en Loyverse **sin cliente asociado** (`customer_id` vacío en el recibo).
- No se verifica duplicidad (comentario del propio código: "POST ciego"): un cliente puede crearse duplicado en Loyverse.
- Lealtad: `getLoyaltyInfoFromLoyverse` calcula `max(3 % de compras web válidas, puntos de Loyverse) − canjes web`. "La verdad absoluta son los puntos de la web"; Loyverse solo sirve como piso. Comentarios contradictorios (10 % vs 3 %). Niveles hardcodeados en código (Estándar/Plata ≥40/Oro ≥90/Diamante ≥140) **a pesar de existir la tabla `loyalty_tiers`**.
- Los canjes (`loyalty_redemptions`) se guardan solo en la web, no se reflejan en Loyverse.

## 6. Inventario / disponibilidad
`/api/cron/sync-inventory` y el webhook actualizan `products.available` comparando `variant_id` de Loyverse con `products.loyverse_item_id` (nombre engañoso: guarda un *variant id*). Como **0 de 24 productos tienen ese campo**, la sincronización de inventario es inerte hoy; la disponibilidad se maneja a mano en el panel de menú.

## 7. Scripts relacionados (`scripts/`)
- Diagnóstico/solo lectura: `diagnose-loyverse.mjs` (con token hardcodeado), `audit-loyverse-mapping.ts`, `analyze-pos-history.ts`, `extract-pos-insights.ts`.
- Escriben en Loyverse y/o BD: `recover-loyverse-orders.mjs` (credenciales hardcodeadas + datos personales; recuperó 4 pedidos de agosto), `sync-loyverse.ts`, `reset_loyverse_customers.js`.
- Ninguno es parte de la app; algunos asumen el bug ya corregido del `receipt_id` (documentado en comentarios: "pedidos del 6-7 de agosto no llegaron por el bug en el campo receipt_id").

## 8. Hallazgos (solo reportados, NO corregidos)

| ID | Hallazgo | Severidad |
|---|---|---|
| **H5.1** | **Repo público con `service_role` de Supabase y token de Loyverse vigentes en el historial (y datos personales de clientes).** | **CRÍTICA** |
| **H5.2** | Todas las ventas web se registran con la variante genérica de Loyverse: sin reportes por producto, sin descuento de inventario. `products.loyverse_item_id` vacío en los 24 productos. | **Alta** (impacta "la data de los dueños") |
| **H5.3** | No hay reintento de recibos fallidos; un fallo deja pedidos `in_preparation`/`delivered` sin venta en el POS (24 casos). | **Alta** |
| **H5.4** | Webhook nunca ha recibido eventos (`webhook_logs` = 0) y su lógica de cancelación escribe una columna inexistente (`cancel_reason`); procesamiento "fire-and-forget" no fiable en Vercel; firma opcional. | Alta |
| **H5.5** | Modo MOCK silencioso si falta una variable `LOYVERSE_*`: genera recibos falsos y los guarda como reales. | Media-Alta |
| **H5.6** | `receipt_number` se usa como id y se duplica en dos columnas; "tarjeta" nunca se distingue de "efectivo" en pagos físicos. | Media |
| **H5.7** | Precio de línea del recibo = precio del frontend, no el calculado en servidor. | Media |
| **H5.8** | Clientes de Loyverse: 16 altas sin procesar (cron no corre) y sin control de duplicados. | Media |
| **H5.9** | `sync-loyverse` filtra clientes por nombres de prueba hardcodeados ("juan…"). | Baja-Media |
| **H5.10** | Lealtad: niveles hardcodeados ignorando `loyalty_tiers`; cálculo local, no sincronizado con Loyverse; comentarios contradictorios (10 % / 3 %). | Baja |

## 9. Qué significa para "Cancelar / Modificar"
1. **No hay que tocar Loyverse** para el alcance acordado (antes de `in_preparation`): en esa ventana no existe recibo. Se puede probar completo sin riesgo para la caja real, con la salvedad de que la BD de pruebas es la de producción.
2. Si algún día se permite cancelar o modificar **con recibo ya creado** (en cocina), "modificar" implicaría anular el recibo y crear otro (no hay edición de recibos en la API), con los riesgos H4.2/H4.7/H5.3: habría que primero cerrar esos huecos (orden de operaciones, idempotencia, cola de reintentos).
3. El campo `cancel_reason` que el webhook ya espera encaja con la auditoría de cancelaciones que se propondrá en la Fase 6.
4. Antes de cualquier despliegue de los cambios, **rotar las credenciales** (sección 0): si no, el repo público seguirá exponiendo producción.
