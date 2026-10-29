# Fase 2 — Base de datos (Supabase / Postgres)

> Fecha: 2026-10-25 · **Solo lectura** (únicamente peticiones GET con la service role; ninguna escritura).
> Proyecto Supabase: **EDEN** (`mnfblwxxehyvspkhdkos`). Es la BD de producción real.
> Fuentes: `scripts/analysis/dump-schema.mjs` → `docs/analysis/data/schema.json` (esquema PostgREST/OpenAPI + conteos), `scripts/analysis/orders-stats.mjs` (agregados sin datos personales).

## 0. Alcance y limitaciones (leer primero)

Solo tengo la API REST de Supabase (no hay connection string de Postgres en `.env.local`). Por eso **sí** obtuve: tablas, columnas, tipos, nulos, defaults, PK/FK, conteos, valores reales de campos de estado, buckets de Storage. **No** pude leer: `CHECK` constraints, índices, triggers, políticas RLS, cuerpo de las funciones, `pg_cron`.

Para cerrar ese hueco dejé `scripts/analysis/schema-introspection.sql`: son 7 consultas `SELECT` que puedes pegar en **Supabase → SQL Editor** y ejecutar (no modifican nada); me pasas el resultado y completo la sección 6. Alternativa: darme la *connection string* de solo lectura.

## 1. Inventario: 19 tablas, ~850 filas

| Tabla | Filas | Propósito |
|---|---:|---|
| `orders` | 308 | Pedidos (núcleo) |
| `users` | 101 | Clientes, cajeros, owners (94 / 4 / 3) |
| `modifiers` | 183 | Opciones de personalización |
| `modifier_groups` | 29 | Grupos de modificadores por producto |
| `products` | 24 | Platillos |
| `variants` | 12 | Tamaños/variantes con precio |
| `categories` | 7 | Categorías del menú |
| `user_saved_addresses` | 18 | Direcciones guardadas |
| `raffle_entries` | 16 | Boletos de rifa (1 por pedido) |
| `loyverse_sync_queue` | 16 | Cola de sincronización con Loyverse (**todas `pending`**) |
| `otp_requests` | 25 | Registro para rate limit de SMS |
| `loyalty_benefits` | 5 | Beneficios canjeables |
| `loyalty_tiers` | 4 | Niveles de lealtad |
| `loyalty_redemptions` | 3 | Canjes realizados |
| `delivery_zones` | 4 | Zonas/tarifas de envío |
| `bank_config` | 2 | Datos bancarios para transferencia (1 activo) |
| `settings` | 2 | Config clave/valor (ubicación del restaurante, etc.) |
| `otp_sessions` | 0 | Sin uso (legado) |
| `webhook_logs` | 0 | Sin uso (el webhook de Loyverse no deja registros) |

Storage: un bucket **`payment-proofs`** (privado, límite 5 MB, mime `jpeg/png/pdf`).
RPC expuesta: `otp_register_request` (límite atómico de OTP).

## 2. Diccionario de datos

Convención: **R** = NOT NULL, `def` = valor por defecto. Todas las tablas usan `uuid` como PK con `gen_random_uuid()` salvo `settings` (key), `loyalty_tiers` (tier_name) y `otp_requests` (bigint).

### 2.1 `orders` (la tabla que nos importa)
| Columna | Tipo | R | Default | Notas |
|---|---|:-:|---|---|
| id | uuid PK | R | gen_random_uuid() | |
| user_id | uuid FK→users.id | | | `ON DELETE SET NULL` según migración. Hoy 0 nulos. |
| customer_name | text | R | | |
| customer_phone | text | R | | |
| customer_email | text | | | |
| **items** | **jsonb** | R | | Ver 2.1.1 |
| **total** | numeric | R | | Calculado por el servidor (`lib/pricing.ts`). No incluye/incluye envío: **por confirmar en Fase 4**. |
| notes | text | | | |
| **status** | text | R | `received` | Estado del pedido. Valores reales: ver 3. |
| **payment_status** | text | R | `pending_payment` | `pending_payment / payment_submitted / payment_approved / payment_rejected` |
| payment_method | text | | | `efectivo`, `transferencia` o NULL |
| proof_url | text | | | Ruta en bucket `payment-proofs` |
| rejection_reason | text | | | |
| loyverse_receipt_id | text | | | UUID del recibo en Loyverse |
| loyverse_receipt_number | text | | | Folio visible |
| service_type | text | | `pickup` | `pickup` o `delivery` (nunca `dine_in` en datos) |
| delivery_address | text | | | |
| delivery_lat / delivery_lng | double | | | GPS destino |
| delivery_distance_km | numeric | | | Calculado en servidor |
| delivery_zone_id | uuid FK→delivery_zones.id | | | |
| delivery_fee | numeric | | | |
| delivery_fee_confirmed | boolean | R | false | El cajero confirma el envío |
| **refund_status** | text | | `none` | Valores esperados: `none/pending/…` (ver 3). |
| refund_proof_url | text | | | |
| created_at / updated_at | timestamptz | R | now() | `updated_at` con trigger (migración) |

**No existen** columnas para: motivo de cancelación, quién canceló, cuándo se canceló, ni historial de cambios. Hoy una cancelación solo cambia `status` y `updated_at`.

#### 2.1.1 Forma real de `orders.items` (muestrado en los 50 pedidos más recientes)
Arreglo de objetos con estas claves (n = veces que aparece entre los items revisados):
`id` (producto) · `name` · `price` · `quantity` · `cartId` (id único de línea en el carrito) · `calculated_unit_price` · `final_subtotal` · `size` (opcional, 54/75) · `notes` (71/75) · `customizations` (71/75).
Es decir, **los precios por línea van congelados dentro del JSON**; no hay tabla `order_items`. Para "modificar pedido" habrá que reemplazar este JSON completo y recalcular `total`, `delivery_fee` y tickets de rifa/loyalty.

### 2.2 `users`
`id` uuid PK · `phone` text R (E.164, único) · `name` text · `role` text R def `customer` (`customer|cashier|owner`) · `loyverse_customer_id` text · `active` boolean R def true · `created_at` timestamptz R. (Los 101 usuarios están activos.)

### 2.3 Menú
- `categories`: id, name R, icon, display_order R, active R, created_at, updated_at, **deleted_at** (borrado lógico).
- `products`: id, category_id→categories, name R, description, base_price R def 0, image_url, available R def true, **loyverse_item_id**, display_order, created_at, updated_at, deleted_at.
- `variants`: id, product_id→products, name R, price R, display_order, created_at, updated_at, deleted_at.
- `modifier_groups`: id, product_id→products, name R, min_selection R def 0, max_selection, free_limit R def 0, extra_price R def 0, required R def false, display_order, created_at, updated_at, deleted_at.
- `modifiers`: id, modifier_group_id→modifier_groups, name R, price_modifier R def 0, available R def true, display_order, created_at, updated_at, deleted_at.

### 2.4 Lealtad y rifa
- `loyalty_tiers`: tier_name PK, min_points R def 0, created_at.
- `loyalty_benefits`: id, name R, description, points_required R, active R def true, created_at, updated_at.
- `loyalty_redemptions`: id, user_id→users R, cashier_id→users R, benefit_id→loyalty_benefits, benefit_description R, points_used R, **order_id→orders**, created_at.
- `raffle_entries`: id, user_id→users R, **order_id→orders R**, order_total R, ticket_printed R def false, created_at.

### 2.5 Entrega y direcciones
- `delivery_zones`: id, label R, max_distance_km R, fee R, active R def true, display_order, created_at, updated_at. (4 zonas, todas activas.)
- `user_saved_addresses`: id, user_id→users R, label R, address_text R, lat R, lng R, is_default R def false, created_at, updated_at.
- `settings`: key PK, value jsonb R, description, updated_at.

### 2.6 Pagos, auth e integraciones
- `bank_config`: id, bank_name R, account_holder R, clabe R, active R def true, created_at, updated_at. *(Datos bancarios del negocio.)*
- `otp_requests`: id bigint PK, phone R, ip, created_at. Alimenta la RPC `otp_register_request`.
- `otp_sessions`: id, phone R, otp_hash R, attempts R def 0, expires_at R, consumed R def false, created_at. **Sin filas, legado** (hoy se usa Twilio Verify).
- `loyverse_sync_queue`: id, entity_type R, entity_id uuid R, payload jsonb R, attempts R def 0, max_attempts R def 5, next_retry_at R def now(), status R def `pending`, last_error, created_at, updated_at.
- `webhook_logs`: id, event_type R, payload jsonb R, processed_at, status R def `pending`, error_details, created_at. Vacía.

## 3. Valores reales de estado en `orders` (308 pedidos, 2026-06-23 → 2026-10-24)

| status | payment_status | n |
|---|---|---:|
| delivered | payment_approved | 190 |
| delivered | **pending_payment** | **47** |
| cancelled | pending_payment | 48 |
| awaiting_payment | pending_payment | 21 |
| in_preparation | payment_approved | 2 |

- `received`, `ready`, `in_transit` **nunca aparecen** en los datos (el flujo real es `awaiting_payment → in_preparation → delivered`).
- `payment_submitted` y `payment_rejected`: 0. **Ningún pedido tiene `proof_url`** → la transferencia con comprobante prácticamente no se usa (solo 5 pedidos con método `transferencia`).
- `payment_method`: efectivo 164, transferencia 5, **NULL 139**.
- `refund_status`: `none` en los 308. Nunca se ha usado el flujo de reembolsos.
- `service_type`: pickup 158, delivery 150.

## 4. Hallazgos de datos (relevantes para "las cuentas no cuadran")

| ID | Hallazgo | Impacto |
|---|---|---|
| **H2.1** | **47 pedidos `delivered` con `payment_status = pending_payment`**. Se entregaron pero el sistema nunca registró el pago como aprobado (el pago en efectivo no se marca). | Los reportes por estado de pago **no cuadran** con la caja. Candidato principal a la queja del cliente. |
| **H2.2** | **24 pedidos `delivered` sin `loyverse_receipt_id`** (≈ 10 %). Entregados y probablemente cobrados, pero sin recibo en el POS. | Ventas que no aparecen en Loyverse → las cuentas no cuadran. |
| **H2.3** | **21 pedidos `awaiting_payment` abandonados** (el más viejo es de 2026-06-23; 20 sin recibo, 1 con recibo). | Pedidos fantasma que nadie cancela; ensucian el kanban/reportes. Es el caso natural de "cancelar". |
| **H2.4** | 2 pedidos `in_preparation` + `payment_approved` con ≥ 2 meses de antigüedad (2026-08-07 y 2026-08-18). | Pedidos "colgados". |
| **H2.5** | **48 pedidos cancelados, 47 sin recibo y 1 con recibo; `refund_status` = `none` en todos.** Ningún cancelado tenía pago aprobado, así que hasta hoy no hizo falta reembolso. | Importante: *hoy todas las cancelaciones ocurrieron antes de pagar*. Es el escenario exacto que pediste (cancelar antes de preparación). |
| **H2.6** | **`loyverse_sync_queue`: 16 trabajos `customer_create`, todos `pending`, `attempts = 0`, `last_error` vacío**, desde 2026-07-31 hasta 2026-10-11. | **Confirma H1.2**: el cron de reintentos jamás se ha ejecutado. 16 clientes nunca se crearon en Loyverse. |
| **H2.7** | `webhook_logs` y `otp_sessions` vacías. | El webhook de Loyverse no deja auditoría (o nunca llegó). A verificar en Fase 5. |
| **H2.8** | Bucket real: `payment-proofs` (guion). `api/admin/finances/cleanup/route.ts:54` usa `.from('payment_proofs')` (guion bajo) y su comentario también. | Ese endpoint de limpieza probablemente no encuentra el bucket y falla en silencio. |
| **H2.9** | Sin tabla de ítems ni de historial/auditoría de pedidos: precio de cada línea solo vive dentro del JSON. | Para auditar cancelaciones/modificaciones hay que **agregar** campos o una tabla de eventos (ver Fase 6). |
| **H2.10** | 139 pedidos con `payment_method` NULL (45 %), coherente con H2.1/H2.3. | Datos de pago incompletos. |

> Corrección a la Fase 0: en el mapa general dije que el `CHECK` de `orders.status` no incluía `ready`/`in_transit`. **Era un error mío**: la migración `…12_add_delivery_fields.sql` sí los agrega. Lo que sí está sin migración son las columnas `payment_method`, `refund_status`, `refund_proof_url` de `orders` y la tabla `raffle_entries` (incluida `ticket_printed`): existen en la BD pero **no** en `supabase/migrations/` (deriva real).

## 5. Relaciones (FK confirmadas)

```
users ──< orders >── delivery_zones
users ──< user_saved_addresses
users ──< raffle_entries >── orders
users ──< loyalty_redemptions (user_id y cashier_id) >── orders, loyalty_benefits
categories ──< products ──< variants
                     └──< modifier_groups ──< modifiers
```
Notas: `orders.items` referencia productos solo por `id` dentro del JSON (sin FK); `loyverse_sync_queue.entity_id` tampoco tiene FK (polimórfico). `raffle_entries.order_id` y `loyalty_redemptions.order_id` apuntan a `orders`: **cancelar o modificar un pedido deberá decidir qué hacer con el boleto de rifa y los puntos/canjes asociados** (no borrar un pedido sin tratar esas filas).

## 6. Pendiente (requiere el SQL de introspección)
- `CHECK` exactos de `status`, `payment_status`, `refund_status`, `service_type`, `payment_method` (¿permiten un nuevo estado o campos de cancelación?).
- Triggers (`update_updated_at`), índices, RLS/políticas, definición de `otp_register_request`.
- ¿Existe `pg_cron` con jobs que sustituyan al cron de la app? (H2.6 sugiere que no.)

## 7. Archivos generados
- `scripts/analysis/dump-schema.mjs` y `orders-stats.mjs` — reutilizables, solo lectura, no guardan datos personales.
- `scripts/analysis/schema-introspection.sql` — para correr en el SQL Editor.
- `docs/analysis/data/schema.json` — volcado bruto (sin datos personales).
