# Plan de corrección — Webhook, recibos/clientes pendientes y credenciales expuestas

> Fecha: 2026-10-25 · Alcance pedido por el dueño: (1) webhook de Loyverse sin registrar, (2) 24 pedidos sin recibo + 16 clientes sin alta (el cron nunca corre), (3) credenciales expuestas en el repo público.
> Regla de trabajo: **cada fase termina con verificación y un punto de aprobación; nada que toque Loyverse real, credenciales o historial de git se ejecuta sin el visto bueno explícito del dueño en ese paso.** Todo cambio de código irá en una rama, con commit propio y despliegue con `npx vercel --prod`; cada fase tiene su reversión.
> ⚠ Este archivo describe vulnerabilidades: **no se sube al repo público** (`docs/` está fuera de git).

## 0. Resultados de la Fase 0 (auditoría de solo lectura, ya ejecutada)

Script: `scripts/analysis/fase0-auditoria.mjs` (solo GET, no imprime secretos ni teléfonos completos).

| # | Hallazgo | Detalle | Acción |
|---|---|---|---|
| A | **La CLABE activa para transferencias es de otra persona** | Activa: *Mercado Pago · titular MAXINE BARRANCO GONZALEZ · …6941*, creada 2026-07-04 (la cuenta *BBVA · Restaurante Edén* quedó inactiva ese mismo día). Existe una cajera con ese nombre (alta 2026-08-18). | **El dueño debe confirmar que es una cuenta suya/autorizada.** La fecha (07-04) es *anterior* a la filtración (08-08), así que no indica por sí sola un ataque; solo hay 5 pedidos con transferencia en la historia. |
| B | Roles elevados | 3 owners (incl. "Dueño Maestro", el usuario que crea `upgrade-role` sin login) y 4 cajeros; 1 cajera dada de alta tras la filtración. | Confirmar que los 7 son personas conocidas. |
| C | Config modificada tras la filtración | `settings`, `delivery_zones`, `loyalty_*`, `categories`: 0 cambios. `products`: 4 filas (edición normal de menú). | Sin señales de manipulación en la config. |
| D | **Pedidos entregados sin recibo: 24 / $2 930** | **21 tienen nombre de prueba** (Juan…, Jesús, Dueño; 8 con pago aprobado = $980, 13 sin pago = $1 460). Solo **3 pedidos reales, $490**, todos `pending_payment` (28–29 sep). | Casi todo es basura de pruebas; probablemente solo hay que decidir sobre 3 pedidos. |
| E | **Cola de clientes: 11 de los 16 ya existen en Loyverse** | 98 clientes en Loyverse; 2 teléfonos ya duplicados; 13 usuarios web sin `loyverse_customer_id`. | **Crear los 16 tal cual duplicaría 11.** Hay que *enlazar* antes de *crear*. |
| F | La API de Loyverse expone `receipt_date` y `source` en los recibos | (`GET /receipts`). | Permite fechar el recibo en el pasado (a confirmar con el primer recibo real, ver Fase 3). |
| G | Vercel | Las 18 variables están en **Production y Preview**; las claves tienen 121 días. Cron no definido. Plan de Vercel por confirmar (Hobby = cron solo 1 vez al día; Pro = cada minuto). | Decide la opción de cron (Fase 2). |

## Fase 1 — Credenciales expuestas (punto 3) · sin caída del servicio

**Objetivo:** que las llaves del repo público dejen de servir, sin cortar la operación. Se hace con rotación "en paralelo" (la nueva convive con la vieja hasta verificar).
Qué se filtró (verificado en la Fase 5): **`SUPABASE_SERVICE_ROLE_KEY`** y **`LOYVERSE_ACCESS_TOKEN`** (+ datos personales de 4 clientes en `recover-loyverse-orders.mjs`). No se filtraron los secretos JWT, Twilio, ni los códigos de owner/cajero.

| Paso | Qué | Quién | Riesgo / reversión |
|---|---|---|---|
| 1.1 | Repo de GitHub → **privado** (`gh repo edit … --visibility private`) | yo (con tu OK) o tú en Settings | Reversible. Efecto: ya no es indexable; las Actions pasan a minutos limitados (2 000/mes gratis) → condiciona la Fase 2. |
| 1.2 | **Loyverse**: Back Office → *Access tokens* → crear token nuevo (tú, 2 min) | **dueño** | Los tokens coexisten; el viejo sigue vivo. |
| 1.3 | `vercel env` → reemplazar `LOYVERSE_ACCESS_TOKEN` (Production+Preview) y `.env.local`; `npx vercel --prod`; verificar con `scripts` de solo lectura (`GET /merchant`, recibos) | yo | Si falla: volver a poner el valor anterior y redesplegar (el viejo aún funciona). |
| 1.4 | Revocar el token viejo en Loyverse | **dueño** | Irreversible para ese token; solo tras 1.3 verificado. |
| 1.5 | **Supabase**: *Settings → API Keys* → crear **secret key** nueva (`sb_secret_…`); *no* rotar el JWT secret (invalidaría `anon` y `service_role` a la vez y cortaría el sitio) | **dueño** | Las claves nuevas y las legacy coexisten ("válidas hasta que las desactives"). |
| 1.6 | `vercel env` → reemplazar `SUPABASE_SERVICE_ROLE_KEY`; probar localmente y en una vista previa (`vercel` sin `--prod`); `npx vercel --prod`; humo: menú, login, pedido de prueba cancelado | yo | Reversión: devolver la clave legacy (sigue activa). Ojo: las claves nuevas **no son JWT** (solo cabecera `apikey`); `supabase-js` lo maneja, mis scripts de diagnóstico se ajustan. |
| 1.7 | **Desactivar** la `service_role` legacy en el panel (reversible: "puedes reactivarla") y comprobar 24 h que nada falla; conservar `anon` (la usa el navegador) | **dueño** | Reversible. |
| 1.8 | Opcional: rotar `OWNER_SECRET_CODE` / `CASHIER_SECRET_CODE` (no estaban en el repo, pero H3.1/H3.2 los hacen muy sensibles) | dueño decide | Cambia códigos que usa el personal; no cierra sesiones. |
| 1.9 | Confirmar con el dueño los puntos **A** y **B** de la auditoría (CLABE activa y lista de roles) | **dueño** | — |

Fuera de esta fase (Fase 5): borrar los scripts con secretos y limpiar el historial.

## Fase 2 — Clientes de Loyverse sin duplicar + cron que sí corra (punto 2, parte 1)

**Problema:** el cron nunca corre; y si se activara tal como está, crearía 16 clientes de los cuales 11 ya existen.

Código (rama `fix/loyverse-clientes-cron`):
1. **Buscar-o-crear** en `createLoyverseCustomer`: antes del `POST`, buscar por teléfono (últimos 10 dígitos) entre los clientes de Loyverse (con caché por ejecución); si existe, **enlazar** su id en `users.loyverse_customer_id`; si no, crear.
2. `retry-loyverse-sync`: modo `?dry_run=1` (solo informa qué haría), recuperación de trabajos atascados en `processing` (hoy un fallo a mitad los deja así para siempre) y tope de lote.
3. Modo `LOYVERSE_DRY_RUN=true` global para pruebas locales sin tocar Loyverse.

Cron (elegir una, según el plan de Vercel que confirmes):
| Opción | Cadencia | Costo/limitación |
|---|---|---|
| A. **Vercel Cron** (`vercel.json`), Vercel envía solo `Authorization: Bearer $CRON_SECRET` | cada 5–10 min en **Pro**; **1 vez al día** en Hobby | Cero infraestructura; ya existe `CRON_SECRET` en Vercel |
| B. GitHub Actions programado | mínimo ~5 min, con retrasos | **Repo privado = 2 000 min/mes gratis**: cada 30 min ≈ 1 450 min; cada 10 min no alcanza |
| C. Servicio externo gratuito (p. ej. cron-job.org) con cabecera Authorization | cada 1–5 min | Depende de un tercero; el secreto vive allí |
| D. Supabase `pg_cron` + `pg_net` | cada minuto | Hay que habilitar extensiones y guardar el secreto en la BD |
Recomendación: A si el plan es Pro; si es Hobby, C o B cada 30 min.

Ejecución con control: (a) desplegar el código; (b) correr `dry_run` y mostrarte la lista de 16 (11 a enlazar, 5 a crear); (c) **tu OK**; (d) procesar los 16; (e) activar el cron; (f) verificar que `loyverse_sync_queue` queda en `completed` y que los 98→103 clientes no tienen duplicados nuevos.
Reversión: desactivar el cron (borrar la entrada) y volver al despliegue anterior; los enlaces ya hechos no dañan.

## Fase 3 — Recibos faltantes: reintento automático + relleno histórico (punto 2, parte 2)

**3A. Que no vuelva a pasar (código):**
1. Cuando falla `createLoyverseReceipt` (en `pay-physical`, `approve-payment` y `status`) → **encolar** un trabajo `receipt_create` en `loyverse_sync_queue` (hoy solo se escribe en consola y se pierde).
2. El mismo cron procesa `receipt_create` con *backoff* y deja `failed_permanent` + aviso visible para el cajero tras N fallos.
3. **Idempotencia:** reservar el pedido (`UPDATE … SET loyverse_sync_lock WHERE loyverse_receipt_id IS NULL AND lock IS NULL`) antes de llamar a Loyverse y guardar el id inmediatamente después; así un doble clic o un reintento no crean 2 recibos (H4.7). Requiere 1–2 columnas nuevas, aditivas.
4. Poner el **id completo del pedido** en la nota del recibo (hoy solo los últimos 4) para poder conciliar a mano.
5. Aviso en el panel: contador "Pedidos sin recibo en Loyverse" (el endpoint `GET /api/admin/sync-loyverse` ya calcula cuántos).

**3B. Los 24 pedidos históricos (decisión del dueño, sin automatismos):**
- 21 son pedidos de pruebas (nombres Juan/Jesús/Dueño): **recomendación: no enviarlos a Loyverse** (inflarían ventas con pruebas) y marcarlos como "no aplica".
- 3 pedidos reales (28–29 sep, $490, sin pago registrado): el dueño dice si se cobraron; si sí, se crean con `receipt_date` = fecha original (si la API lo acepta; se valida con el primer recibo, uno por uno, con tu OK) y método efectivo; si no se cobraron, se dejan sin recibo.
- Se hace con un script con `--dry-run` por defecto y confirmación manual por pedido; no se usa el endpoint genérico `sync-loyverse` (excluye "juan…" a ciegas y fecharía los recibos "hoy").
- Verificación: el recibo existe en Loyverse (`GET /receipts/{n}`), `orders.loyverse_receipt_*` guardado, y el total del día/mes de Loyverse no cambia más de lo esperado.

Reversión de 3A: volver al despliegue anterior (las columnas nuevas son inofensivas). 3B: un recibo creado en Loyverse solo se anula con un reembolso (por eso se hace uno por uno).

## Fase 4 — Webhook de Loyverse (punto 1)

**Hoy:** 0 webhooks registrados; el endpoint procesa en segundo plano sin esperar (en Vercel se puede cortar), compara la firma sin tiempo constante, acepta peticiones sin firma si falta el secreto, y escribe una columna (`cancel_reason`) que **ya existe** gracias a la migración de cancelaciones.

Código (rama `fix/loyverse-webhook`):
1. Procesar **antes** de responder (o con `after()` de Next) para que no se pierda en serverless; registrar siempre en `webhook_logs` y marcar `processed/error`.
2. Firma: comparación en tiempo constante; en producción, **rechazar si no hay secreto configurado**. *(Por verificar: el nombre exacto de la cabecera y de qué secreto se firma; las fuentes no oficiales discrepan entre `X-Loyverse-Signature` y `X-Loyverse-Webhook-Signature`. Se resuelve con una entrega real de prueba.)*
3. Anulación en POS → cancelar el pedido web con `cancelled_by='pos'`, `cancelled_at`, `cancel_reason` (hoy no los pone) y **no tocar pedidos ya `delivered`** (un reembolso posterior en caja cancelaría una venta ya cumplida y descuadraría reportes) → *decisión del dueño*: registrar solo en el log o marcar `refund_status`.
4. Ignorar el evento que genera nuestro propio reembolso (el pedido ya está `cancelled`) y los recibos que no son de la web (el POS tiene su propia numeración "4-xxxx").
5. Eventos de inventario/artículos: **se dejan inactivos** hasta que los productos tengan `loyverse_item_id` (hoy 0 de 24); es un proyecto aparte (mapeo de productos, también arregla que las ventas web salgan como "artículo genérico").

Registro y prueba:
- Primero con una entrega de prueba local firmada con un secreto de prueba (sin tocar Loyverse).
- Registrar el webhook (`POST /v1.0/webhooks`, tipo `receipts.update`, estado `ENABLED`, `url=https://www.eden-ensaladas.com/api/webhooks/loyverse`) — **solo con tu OK**; es una configuración persistente en tu Loyverse. Si algo falla, se deshabilita (`status: DISABLED`) o se borra.
- Prueba extremo a extremo real (necesita tu OK): crear un pedido de $1 de prueba, que pase por caja, anularlo desde el POS y confirmar que el pedido web se cancela con `cancelled_by='pos'`.

## Fase 5 — Limpieza y prevención

1. Borrar `scripts/recover-loyverse-orders.mjs` y `scripts/diagnose-loyverse.mjs` del repo (ya sin secretos válidos tras la Fase 1) y mover credenciales de cualquier otro script a variables de entorno.
2. **Reescribir el historial de git** para eliminar esos archivos (y los datos personales de 4 clientes): `git filter-repo` + `push --force`. Es destructivo para quien tenga clones (hay que volver a clonar) y cambia los hashes; **solo si el dueño lo decide**, después de la rotación (así ya no es urgente para seguridad, solo por privacidad de los clientes).
3. Activar *Secret scanning* y *Push protection* de GitHub (gratis en repos públicos; en privados requiere plan de pago) y un chequeo previo al commit (`gitleaks`/script) para que no vuelva a pasar.
4. Retirar el workflow de Azure (falla en cada push) y, si se elige GitHub Actions para el cron, reutilizar el archivo.
5. Actualizar `.env.example` y `LAUNCH_GUIDE.md`; documentar el procedimiento de rotación.
6. (Opcional, seguridad relacionada) corregir H3.1/H3.2 (`become-cashier` y `upgrade-role` sin OTP) en un cambio aparte.

## Orden recomendado y tiempos aproximados

| Fase | Depende de | Esfuerzo | ¿Toca Loyverse real? | Requiere al dueño |
|---|---|---|---|---|
| 0 Auditoría | — | **hecha** | Solo lectura | Confirmar A y B |
| 1 Credenciales | 0 | 1–2 h repartidas | Token nuevo/viejo | Crear token Loyverse y clave Supabase; revocar las viejas |
| 2 Clientes + cron | 1 (para no reconfigurar el token) | 3–4 h | Altas/enlaces de 16 clientes | OK tras el *dry-run*; plan de Vercel |
| 3 Recibos | 2 | 4–6 h | Sí (3 pedidos si se aprueban) | Decisión sobre los 3 pedidos reales |
| 4 Webhook | 1, 3A (comparten cola) | 3–4 h | Registro del webhook + 1 prueba de $1 | OK de registro y de la prueba |
| 5 Limpieza | 1 | 1–2 h | No | OK para reescribir el historial |

## Decisiones que necesito del dueño
1. ¿Confirmas que la **CLABE de Mercado Pago de Maxine Barranco Gonzalez** es legítima, y los 7 usuarios con rol? (puntos A y B)
2. ¿Plan de Vercel: **Hobby o Pro**? (define el cron)
3. ¿Autorizas la rotación en paralelo de la Fase 1 (tú creas las llaves nuevas, yo las pongo en Vercel y verifico)? ¿Y poner el repo en **privado**?
4. Los 3 pedidos reales sin recibo ($490): ¿se cobraron? Los 21 de pruebas: ¿se descartan?
5. Webhook: un reembolso en caja sobre un pedido ya entregado, ¿qué hacemos: ignorarlo o marcarlo como reembolso?
