# Fase 6 — Frontend y diseño de los dos cambios (Cancelar / Modificar pedido)

> Fecha: 2026-10-25 · Solo lectura + diseño. **No se escribió código de la app.** Este documento es la propuesta para aprobar antes de implementar.
> Reglas de negocio confirmadas por el dueño: el cliente puede cancelar/modificar **solo antes de que el pedido esté en preparación**; el Loyverse es real y compartido (no hay entorno de pruebas).
> Nota para quien implemente: `AGENTS.md` exige leer `node_modules/next/dist/docs/` antes de escribir código (Next 16.2.6, API de rutas con `params` como `Promise`, ya usado en el repo).

## 1. Mapa del frontend (qué consume qué)

| Pantalla | Archivo (líneas) | APIs que usa | Mecánica de actualización |
|---|---|---|---|
| Menú + carrito + checkout + login OTP | `src/app/page.tsx` (2 330) | `GET /api/menu`, `/api/sms`, `/api/auth/verify-otp`, `/api/delivery/quote` (vía `DeliveryAddressSelector`), `POST /api/orders`, `GET /api/me/orders` | Carrito en `localStorage['eden_cart']`; sesión en `eden_user_session`; botón flotante "pedido activo" → `/orden/{id}` |
| Seguimiento del cliente | `src/app/orden/[id]/page.tsx` (1 128) | `POST /api/auth/refresh`, `GET /api/orders/[id]`, `/api/bank-config`, `pay-physical`, `proof`, `confirm-receipt` | **Polling cada 3.5 s** (cada ciclo hace `refresh` + `GET`) **y** Supabase Realtime sobre `orders` |
| Panel del personal | `src/app/admin/page.tsx` (818) + `KanbanBoard.tsx` (497) + `FinanceApproval`, `RefundsManager`, etc. | `GET /api/orders` (24 h), `PATCH /orders/[id]/status`, `approve/reject/reset-payment`, `delivery-fee`… | **Polling cada 25 s**; detecta pedidos nuevos **solo por id nuevo** (campana + badge 8 s) |
| Repartidor | `src/app/repartidor/page.tsx` (765) | `GET /api/orders/delivery`, `PATCH /status` | Polling |
| Perfil, rifa, become-cashier/owner | `perfil`, `rifa`, … | `/api/me/*` | — |

Datos útiles para el diseño:
- Los ítems del carrito (`CartItem`: `cartId, id(UUID), name, price, size, quantity, customizations, notes`) son **exactamente** lo que se guarda en `orders.items` (+ `calculated_unit_price`, `final_subtotal`). Por tanto un pedido se puede volver a cargar en el carrito sin conversión.
- El checkout para `delivery` exige una cotización vigente (`deliveryQuote.in_range`) obtenida con el selector de dirección (1 215 líneas): restaurarla programáticamente es riesgoso; en una primera versión se vuelve a elegir la dirección.
- El cajero **no recibe aviso** cuando un pedido cambia o se cancela: solo desaparece del tablero en el siguiente poll (≤25 s). Si el cajero está en pleno "Confirmar ingredientes" sobre un pedido que el cliente acaba de cancelar, hoy el API respondería `Transicion invalida` (400) y la UI muestra un `alert` crudo.
- `GET /api/orders/[id]` ya devuelve `select('*')`, por lo que cualquier columna nueva llega al cliente sin tocar ese endpoint.

## 2. Decisiones de diseño (con recomendación)

### 2.1 Qué significa "antes de preparación"
Ventana permitida = `status ∈ {received, awaiting_payment}` **y** `payment_status = pending_payment`.
- Si ya hay comprobante enviado (`payment_submitted`) el cliente **no** puede cancelar solo: hay dinero en juego y un cajero podría estar aprobándolo; se le muestra "Ya enviaste tu comprobante, contacta a caja" con enlace de WhatsApp (el que ya existe).
- Una vez que toca "Pagar en físico" el pedido pasa a `in_preparation` y cierra la ventana (comportamiento actual). **Pregunta pendiente al dueño**: ¿se acepta que quien se equivoque *después* de elegir efectivo tenga que pedir al cajero que cancele? (Lo cubre el botón nuevo del cajero, §4.)

### 2.2 Cancelar: endpoint propio del cliente, no reutilizar `/status`
`/status` exige rol cajero y tiene efectos de Loyverse. Se crea `POST /api/orders/[id]/cancel`.

### 2.3 Modificar: dos opciones evaluadas
| | **A. Editar en sitio** (`PATCH …/items`) | **B. Reemplazar** (editar = nuevo pedido que sustituye al anterior) ⭐ recomendada |
|---|---|---|
| Idea | Se reescriben `items` y `total` del mismo pedido | Se vuelve a cargar el pedido en el carrito; al enviar se crea uno nuevo y el viejo se cancela con motivo `modified` en una sola operación |
| Reutiliza | `calculateOrderTotal`; necesita UI de edición nueva | **Todo el checkout actual** (precios, envío, validaciones, carrito) |
| Riesgo de regresión | Alto: hay que meter un "modo edición" en `page.tsx` + endpoint que recalcule envío/total/ rifa | Bajo: una variable (`replaces_order_id`) en un endpoint existente + un banner en el carrito |
| Aviso al cajero | Hay que inventarlo (el cajero solo detecta ids nuevos) | **Gratis**: aparece un id nuevo → suena la campana; el viejo desaparece |
| Auditoría | Requiere tabla de versiones | **Natural**: pedido viejo `cancelled` (`cancel_reason='modified'`, `replaced_by`) + pedido nuevo (`replaces_order_id`) |
| Costo | Cambia dirección de envío y tarifa de forma delicada | Cambia el número de ticket (últimos 4 de la UUID); el cliente lo ve en pantalla |

**Detalle clave de B (sin perder el pedido):** no se cancela al pulsar "Modificar", sino **al enviar el nuevo**. Si el cliente abandona la edición, el pedido original sigue vivo. Si entre tanto el cajero ya lo pasó a preparación, el envío responde 409 "tu pedido ya está en preparación; no se puede modificar" y el cliente decide qué hacer.

## 3. Cambios de base de datos (propuesta, todos aditivos y nulos)

```sql
-- Aditivo y seguro: no cambia filas existentes ni constraints existentes.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancelled_at         timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by         text,        -- 'customer' | 'staff' | 'pos' | 'system'
  ADD COLUMN IF NOT EXISTS cancel_reason        text,
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replaces_order_id    uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replaced_by_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_cancelled_by_check
  CHECK (cancelled_by IS NULL OR cancelled_by IN ('customer','staff','pos','system'));

CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at ON public.orders(cancelled_at) WHERE cancelled_at IS NOT NULL;
```
- `cancel_reason` es justo la columna que el webhook de Loyverse **ya intenta escribir** (H5.4) → de paso deja de fallar.
- Orden de despliegue: **primero el SQL** (no rompe nada), **después** el código. Se ejecuta en el SQL Editor de Supabase y se guarda además como `supabase/migrations/2024…20_order_cancellation_audit.sql` (la deriva de migraciones, H1/Fase 2, hace riesgoso un `supabase db push`; recomiendo no usarlo hasta reconciliar).
- Los `CHECK` de `status` **no cambian** (ya incluyen `cancelled`).
- Opcional (no necesario): backfill `cancelled_by='staff'`, `cancel_reason='(histórico)'` de los 48 cancelados existentes para que los reportes no tengan NULL.

## 4. Diseño detallado

### 4.1 Cancelar (cliente) — `POST /api/orders/[id]/cancel`
```
Auth:    requireRole(req,'customer')            (patrón de confirm-receipt)
Body:    { reason?: 'equivocacion' | 'ya_no_lo_quiero' | 'tardanza' | 'otro', note?: string(≤200) }
Pasos:   1. SELECT id, user_id, status, payment_status
         2. user_id ≠ token.user_id           → 403
         3. si ya está cancelled              → 200 idempotente
         4. UPDATE orders SET status='cancelled', cancelled_at=now(), cancelled_by='customer',
                cancelled_by_user_id=:uid, cancel_reason=:reason
            WHERE id=:id AND user_id=:uid
              AND status IN ('received','awaiting_payment') AND payment_status='pending_payment'
            RETURNING id
         5. 0 filas → releer y responder 409 con mensaje específico:
              in_preparation+  → "Tu pedido ya está en preparación…"
              payment_submitted → "Ya enviaste tu comprobante, contacta a caja"
Efectos: ninguno en Loyverse (no hay recibo), ni rifa, ni lealtad (no cuentan hasta pago aprobado).
```
Atomicidad: el `UPDATE … WHERE status IN (…)` resuelve la carrera contra el cajero (si éste ya pasó a `in_preparation`, el UPDATE no afecta filas). Y la ruta `/status` del cajero ya usa `.eq('status', currentStatus)`, por lo que no puede reactivar un pedido cancelado.

### 4.2 Modificar — extensión de `POST /api/orders`
- Body opcional nuevo: `replaces_order_id`.
- Si viene: cargar el pedido viejo; validar propiedad y ventana (mismos criterios de §2.1) → si no, 409 antes de crear nada.
- Crear el pedido nuevo como hoy (mismos cálculos de precios y envío; `replaces_order_id` guardado).
- Cancelar el viejo con el `UPDATE … WHERE status IN (…)` de §4.1 (`cancelled_by='customer'`, `cancel_reason='modified'`, `replaced_by_order_id=<nuevo>`). Si 0 filas (carrera), **borrar el pedido nuevo recién creado** (sin efectos colaterales aún) y responder 409.
- Rendimiento: 1 `SELECT` + 1 `UPDATE` extra, solo cuando se edita.

### 4.3 Cliente — UI (`/orden/[id]` y `/`)
**`/orden/[id]` (archivo de 1 128 líneas; el cambio es pequeño y localizado):**
- Nuevo bloque "¿Te equivocaste?" visible si `status ∈ {received, awaiting_payment}` y `payment_status = pending_payment`, con dos botones: **Modificar pedido** y **Cancelar pedido**. En `awaiting_payment` se coloca justo encima/debajo de las opciones de pago (donde hoy el cliente decide).
- **Cancelar**: modal de confirmación con motivos (chips: "Me equivoqué de platillo", "Ya no lo quiero", "Tardó mucho", "Otro") → `POST …/cancel` → `fetchOrder()`. El estado `cancelled` ya está dibujado; se añade título según `cancelled_by` (cancelado por ti / por el restaurante) y un botón "Hacer un nuevo pedido".
- **Modificar**: guarda en `localStorage` `eden_cart` (los `items` del pedido, sin `calculated_unit_price`/`final_subtotal`) y `eden_edit_order = { id, short, service_type }`, y navega a `/?edit=1`.
- Con `payment_submitted`: mostrar texto + WhatsApp en lugar de botones.

**`/` (checkout):**
- Si existe `eden_edit_order`: banner fijo en el carrito "Estás modificando tu pedido #ABCD. Al enviarlo reemplazará al anterior" + botón "Descartar cambios" (borra la clave). Al enviar, `submitOrder` añade `replaces_order_id`; en 409 muestra el mensaje del servidor y ofrece volver al pedido. Al terminar se borra `eden_edit_order`.
- Para `delivery` v1 pide elegir la dirección de nuevo (el selector exige cotización). Mejora v2: precargar la dirección guardada.
- Reprecio: el servidor ya recalcula; ojo con el "piso de precio del frontend" (H4.8): si algún precio bajó desde que se hizo el pedido, el cliente seguiría pagando el viejo. Para la edición conviene limpiar `price` y dejar que se recalcule — a validar en pruebas.

### 4.4 Personal — cancelar (y aviso)
- **Botón "Cancelar pedido" en el modal del Kanban para todos los estados activos** (hoy solo existe "Rechazar" en `received`), con selector de motivo obligatorio (agotado, cliente lo pidió por WhatsApp, error de captura, no-show, otro). Si el pedido ya tiene recibo en Loyverse, el texto de confirmación avisa: "Esto anulará el recibo #XXXX en Loyverse".
- `PATCH /orders/[id]/status`: aceptar `{ status:'cancelled', reason }` y guardar `cancelled_at/by/by_user_id/cancel_reason` (hoy no se guarda nada). Se mantiene el comportamiento actual con Loyverse; opcionalmente (hardening aparte) invertir el orden "Loyverse → BD" (H4.2).
- Aviso de cancelación por cliente: en `fetchOrders` comparar con el poll anterior; si un id que estaba activo pasa a `cancelled` con `cancelled_by='customer'`, mostrar toast "El cliente canceló #ABCD (motivo)" y sonar la campana. (Con el flujo B, el pedido nuevo ya activa la campana existente.)
- Mensaje amigable cuando `/status` responde "transición inválida" porque el cliente se adelantó: "Este pedido fue cancelado por el cliente".
- Sección "Cancelados de hoy" (colapsable) en `cocina` con hora, quién y motivo → da al dueño la trazabilidad que pidió para cuadrar cuentas.

### 4.5 Qué NO se toca (alcance acotado)
Loyverse (no hay recibo en la ventana), rifa, lealtad, esquema de `items`, flujo de pago, `reset-payment`, webhooks, cron. Los hallazgos de esas áreas se listan en §7 como trabajo aparte.

## 5. Archivos que se modificarían (estimado)

| Archivo | Cambio | Tamaño |
|---|---|---|
| `supabase/migrations/…_order_cancellation_audit.sql` (nuevo) + SQL manual | columnas de auditoría | pequeño |
| `src/app/api/orders/[id]/cancel/route.ts` (nuevo) | §4.1 | ~80 líneas |
| `src/app/api/orders/route.ts` | `replaces_order_id` en `POST` | ~40 líneas |
| `src/app/api/orders/[id]/status/route.ts` | guardar motivo/actor en cancelación | ~15 líneas |
| `src/types/api-contracts.ts` | tipos nuevos (`reason`, `replaces_order_id`) | pequeño |
| `src/lib/permissions.ts` | registrar `POST /api/orders/:id/cancel: customer` | 1 línea |
| `src/app/orden/[id]/page.tsx` | bloque "¿Te equivocaste?", modal, textos de cancelado | ~120 líneas |
| `src/app/page.tsx` | banner de edición + `replaces_order_id` + carga desde `eden_edit_order` | ~50 líneas |
| `src/components/admin/KanbanBoard.tsx` + `admin/page.tsx` | botón cancelar con motivo, toast, sección cancelados | ~120 líneas |
| `src/app/globals.css` | estilos de los nuevos bloques | pequeño |

## 6. Plan de pruebas (sin afectar Loyverse real)

La BD es la de producción, así que las pruebas deben usar **un usuario de prueba propio** y limpiar después.
1. **Unitarias/puras** (sin red): función que decide si un pedido es cancelable/modificable por estado y `payment_status` (tabla de verdad), y validadores del body.
2. **Integración contra producción, solo con pedido de prueba propio en `received`/`awaiting_payment`** (no genera recibo, rifa ni puntos): cancelar; cancelar dos veces (idempotente); cancelar pedido ajeno (403); cancelar en `in_preparation` (409); carrera cajero↔cliente (dos solicitudes casi simultáneas); modificar con éxito (viejo `cancelled/modified`, nuevo vivo, campana en admin); modificar tras pasar a preparación (409 y el nuevo **no** queda creado); abandonar la edición (viejo intacto); delivery (dirección de nuevo).
3. **Verificación visual** en navegador móvil: `/orden/[id]` y modal del Kanban.
4. **Lo único que tocaría Loyverse**: el botón del cajero sobre un pedido **ya en cocina**. Se prueba al final y solo con un pedido de $1 acordado con el cliente (o no se prueba y se difiere si el dueño lo prefiere).
5. Limpieza: marcar/eliminar pedidos de prueba (`customer_name` identificable) y verificar con `scripts/analysis/orders-stats.mjs` que no queden pedidos colgados.
6. `npx tsc --noEmit` debe seguir en 0 errores (hoy está limpio); `eslint` no debe empeorar en los archivos tocados.

## 7. Consolidado de hallazgos y prioridad sugerida

**P0 — antes de cualquier despliegue**
1. **H5.1** Repo público con `service_role` de Supabase y token de Loyverse vigentes → rotar, repo privado, limpiar historial.
2. **H3.1 / H3.2** `become-cashier` y `upgrade-role`: acceso de cajero/owner con solo un código, sin OTP; el segundo emite sesión de owner sin login. (Rotar los códigos si hay sospecha.)
3. **H1.3** `npm audit`: `next` con vulnerabilidad crítica.

**P1 — relacionados con "las cuentas no cuadran"**
4. **H4.6 / H4.1 / H4.2** pago "físico" aprobado sin cobro; `reset-payment` sin validar estado; orden Loyverse→BD en la cancelación.
5. **H4.5 / H5.3** recibos fallidos sin reintento (24 ventas sin recibo); **H1.2 / H2.6** el cron nunca corre (16 altas de cliente sin procesar).
6. **H4.4** auditoría de cancelaciones (la cubre este diseño).
7. **H5.2** ventas web como artículo genérico en Loyverse; **H5.4** webhook inerte y con columna inexistente.

**P2 — mantenibilidad**
8. Deriva de esquema y migraciones incompletas (H1/H2); `ROUTE_PERMISSIONS` incompleto (H3.7); rate limit en memoria (H1.4/H3.5); workflow de Azure (H1.1); 606 avisos de lint, 0 tests, archivos de 1 000–3 500 líneas; `check-phone` filtra nombres (H3.3); `/orden/[id]` hace `refresh` + `GET` cada 3.5 s por cliente (carga innecesaria a Vercel/Supabase).

## 8. Orden de trabajo propuesto para implementar

| Paso | Contenido | Riesgo |
|---|---|---|
| 0 | **Rotar credenciales / repo privado** (acciones del dueño) | — |
| 1 | SQL aditivo de §3 en Supabase | Muy bajo |
| 2 | Cancelar (cliente): endpoint + UI en `/orden/[id]` + estilos | Bajo |
| 3 | Cancelar (personal) con motivo + toast + "Cancelados de hoy"; guardar actor en `/status` | Bajo-medio |
| 4 | Modificar (opción B): `replaces_order_id` + banner/edición en `/` y botón en `/orden/[id]` | Medio |
| 5 | Pruebas de §6 y despliegue a Vercel | — |
| 6 | (Aparte, si el dueño lo autoriza) hardening P1 | Variable |

Los pasos 2–4 se pueden entregar y desplegar de forma independiente; "Cancelar" ya resuelve gran parte de la queja y no depende de "Modificar".

## 9. Decisiones que necesito del dueño
1. ¿Se aprueba la **opción B** para "Modificar" (nuevo pedido que reemplaza al anterior, cambia el número de ticket)? ¿O se prefiere editar en sitio (A), más costoso y delicado?
2. ¿Quien elige "Pagar en físico" y se equivoca debe pedir la cancelación al cajero (ventana cerrada), o se quiere una excepción corta? (Por defecto: cerrada.)
3. ¿Motivos de cancelación para cliente y personal: los de §4.3/§4.4 o se cambian?
4. ¿Autoriza ejecutar el SQL aditivo de §3 en Supabase (lo corre usted en el SQL Editor, o me da una cadena de conexión de escritura limitada)?
5. ¿Quiere que el hardening P1 (recibos sin reintento, cron, `reset-payment`) se planifique después como proyecto aparte?
