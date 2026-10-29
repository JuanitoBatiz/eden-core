# Edén Menú — Mapa general y plan de análisis

> Fecha: 2026-10-25 · Estado: **mapeo general (solo lectura)**. Nada del código fue modificado.
> Objetivo final: poder implementar (1) **cancelar pedido** y (2) **modificar pedido** sin romper nada.
> Los hallazgos van aquí y en los docs de cada fase; **no se corrigen** hasta que se pida.

---

## 1. Mapa general (lo que se sabe hoy)

### Stack
| Capa | Tecnología | Notas |
|---|---|---|
| Framework | **Next.js 16.2.6** (App Router) + React 19.2 + TypeScript 5 | `AGENTS.md` advierte que esta versión tiene cambios incompatibles: leer `node_modules/next/dist/docs/` antes de escribir código. |
| Estilos | Tailwind 4 + un `globals.css` de **3 549 líneas** | CSS casi todo global/manual. |
| Base de datos | **Supabase** (Postgres + Storage), cliente `@supabase/supabase-js` | Todo el backend usa `service_role` (salta RLS). |
| Auth | OTP por SMS (**Twilio Verify**) + JWT propios (access/refresh/QR) con `jsonwebtoken`, `bcrypt`, cookies | Roles: `customer` < `cashier` < `owner`. |
| POS | **Loyverse** (API + webhook + cola de reintentos) | Se crea el recibo al pasar a `in_preparation`; se reembolsa al cancelar. |
| Mapas | Google Maps (Places, Distance Matrix, Geocoding) | Cálculo de envío y zonas de entrega. |
| Hosting | **AMBIGUO**: hay `.github/workflows/main_eden-menu-prod.yml` (deploy a **Azure Web App** `eden-menu-prod` en cada push a `main`) **y** carpeta `.vercel/` (proyecto `eden-menu`). Hay que confirmar cuál es producción real. |
| CI | GitHub Actions: `npm install` + `build`; no hay tests ni lint en CI. |

### Roles (por `src/lib/permissions.ts`)
`customer` → `cashier` → `owner` (jerarquía). "Admin" del cliente = `owner`. Hay rutas para auto-promoverse (`/become-cashier`, `/become-owner`) protegidas por códigos secretos en variables de entorno.

### Pantallas principales
`/` (menú + carrito + checkout, 2 330 líneas) · `/orden/[id]` (seguimiento del cliente, 1 128 líneas) · `/perfil` · `/rifa` · `/admin` (panel owner/cajero, Kanban) · `/repartidor` · `/become-cashier` · `/become-owner`.

### Tablas detectadas (por `.from()` en el código; **hay que verificar contra la BD real**)
`orders`, `products`, `users`, `modifier_groups`, `modifiers`, `variants`, `categories`, `delivery_zones`, `user_saved_addresses`, `raffle_entries`, `loyverse_sync_queue`, `settings`, `loyalty_redemptions`, `loyalty_tiers`, `loyalty_benefits`, `bank_config`, `webhook_logs`, `payment_proofs`, `otp_requests`.

### Ciclo de vida del pedido (hoy)
- `status`: `received → awaiting_payment → in_preparation → ready → in_transit → delivered`, y `cancelled` desde cualquier estado no final (`VALID_TRANSITIONS` en `src/app/api/orders/[id]/status/route.ts`).
- `payment_status`: `pending_payment → payment_submitted → payment_approved | payment_rejected`.
- `refund_status` se pone en `pending` si se cancela con pago aprobado (gestor en `RefundsManager`).
- Recibo Loyverse: se crea al pasar a `in_preparation`; al cancelar se llama `refundLoyverseReceipt`.

---

## 2. Hallazgo clave para las dos tareas

**La cancelación ya existe en el backend y para el personal.** `PATCH /api/orders/[id]/status` acepta `cancelled`, y `KanbanBoard.tsx` tiene botón "Cancelar" para cajero/owner (líneas ~327 y ~425). Lo que **falta** es:

1. **Cancelación por parte del cliente** (no hay botón en `/orden/[id]`, y el endpoint exige rol `cashier`).
2. **Modificación de pedido** (no existe ni endpoint, ni UI, ni para cliente ni para personal).

Consecuencias que el análisis debe resolver antes de tocar nada:
- ¿Hasta qué estado puede el cliente cancelar/modificar? (p. ej. solo `received`/`awaiting_payment`, antes de que exista recibo Loyverse.)
- Si ya hay pago aprobado y/o recibo en Loyverse: reembolso, anulación del recibo y, para *modificar*, ¿anular y recrear el recibo?
- `orders.items` es `jsonb` y `total` se calcula en servidor (`src/lib/pricing.ts`): la modificación debe **recalcular** y no confiar en el cliente.
- Efectos colaterales: puntos de lealtad, canjes (`loyalty_redemptions`), costo de envío (`delivery-fee`), comprobante de pago subido.
- La cancelación por cliente debe ser auditable (quién, cuándo, motivo) — el cliente se queja de que "las cuentas no cuadran".

---

## 3. Hallazgos preliminares (solo reportados, NO corregidos)

| # | Hallazgo | Severidad prelim. |
|---|---|---|
| H1 | **Deriva de esquema**: solo 19 migraciones; el código usa tablas (`raffle_entries`, `loyalty_redemptions`, `loyalty_tiers`, `payment_proofs`, `loyverse_sync_queue` está en migración 8, pero `refund_status`, `ready`/`in_transit` y otras columnas no) que no aparecen en migraciones. El `CHECK` de `orders.status` en migraciones **no incluye `ready` ni `in_transit`**, aunque el código los usa → la BD real debe haberse cambiado a mano. | Alta |
| H2 | Hosting ambiguo: workflow de Azure **y** proyecto Vercel. | Media |
| H3 | Archivos monolíticos: `page.tsx` 2 330 líneas, `DeliveryAddressSelector` 1 215, `orden/[id]/page.tsx` 1 128, `admin/page.tsx` 818, `globals.css` 3 549. | Media (mantenibilidad) |
| H4 | Tipado débil: uso extendido de `any` en rutas (`catch (authErr: any)`, `updateData: any`). | Baja |
| H5 | Código duplicado: Haversine/Distance Matrix repetido en `/api/orders` y `/api/delivery/quote`; creación manual de cliente Supabase en `status/route.ts` en vez de `createAdminClient()`. | Baja |
| H6 | Seguridad: todo el backend usa `service_role`; RLS efectivamente no se usa. CSP con `'unsafe-eval'` y `'unsafe-inline'`. `next.config.ts` con `@ts-ignore`. | Media |
| H7 | `scripts/` con ~40 scripts ad hoc (arreglos de CSS, precios, etc.) mezclados con herramientas útiles (sync Loyverse, auditoría). Varios modifican la BD directamente. | Baja |
| H8 | Archivos sueltos en la raíz y en `public/` (QR, videos, `convert_video.ps1`, SVGs de plantilla). `.env.vercel` y `.env.local` existen localmente — verificar que estén ignorados por git (no aparecen en `git ls-files`, bien). | Baja |
| H9 | `LAUNCH_GUIDE.md` y `README.md` desactualizados (README es el de `create-next-app`; la guía no menciona Twilio Verify, Azure/Vercel, cron, etc.). Sin tests automáticos. | Baja |
| H10 | `src/app/api/test/route.ts` existe: revisar que no exponga nada en producción. | A verificar |

---

## 4. Plan de implementación del análisis (6 fases)

Cada fase produce un documento en `docs/analysis/`. Entre fases te muestro el resultado y tú decides si seguimos.

### Fase 1 — Infraestructura, entorno y despliegue → `01-infraestructura.md`
- Resolver Azure vs Vercel (revisar workflow, `.vercel/`, `supabase/.temp/`, dominios).
- Inventario de **todas** las variables de entorno (nombre, para qué sirve, dónde se usa, si es pública/secreta; **sin escribir valores**).
- Cómo correr local, build, scripts de `package.json`, `tsconfig`, ESLint, CSP/headers, cron jobs (`/api/cron/*` y quién los dispara).
- Servicios externos: Supabase, Twilio, Loyverse, Google Maps.

### Fase 2 — Base de datos real → `02-base-de-datos.md` (+ script reutilizable)
- Script de solo lectura (en `scripts/analysis/`, usando `pg`/Supabase con credenciales de `.env.local`) que vuelque **tabla por tabla, columna por columna**: tipo, nullable, default, PK/FK, `CHECK`, índices, triggers, políticas RLS, funciones, buckets de Storage y conteo de filas.
- Comparar BD real vs. las 19 migraciones → lista de deriva (H1).
- Documentar valores reales de `status`, `payment_status`, `refund_status`, `service_type`, `payment_method`, etc.
- Salida: diccionario de datos completo + diagrama de relaciones.
- *Necesito tu confirmación antes de conectarme a la BD de producción (ver sección 5).*

### Fase 3 — Autenticación, roles y permisos → `03-auth-roles.md`
- Flujo OTP → JWT → cookies → refresh → logout; `lib/auth.ts`, `requireRole`, `usePermissions`.
- Matriz real de rutas × rol (comparada con `ROUTE_PERMISSIONS`; detectar rutas sin cubrir).
- Cómo se asigna cada rol, usuarios desactivados, rate limit.

### Fase 4 — Pedidos, pagos y estados (el núcleo) → `04-ordenes-y-pagos.md`
- Recorrido completo: carrito → `POST /api/orders` → pago (transferencia/comprobante, efectivo, `pay-physical`, `approve/reject/reset-payment`) → `status` → `confirm-receipt` → reembolsos.
- Diagrama de estados `status` × `payment_status` × `refund_status` y qué transiciones/efectos hay (lealtad, rifa, Loyverse, WhatsApp).
- Cálculo de precios y envío (`pricing.ts`, `delivery/quote`, `delivery-fee`).
- Estado de `orders.items` (forma del JSON) — base para "modificar pedido".

### Fase 5 — Integración Loyverse → `05-loyverse.md`
- `lib/loyverse.ts`, webhook (verificación HMAC), `loyverse_sync_queue` + cron de reintentos, `sync-loyverse`, mapeo producto/variante ↔ Loyverse, cliente Loyverse, **reembolso de recibo** y qué pasaría al modificar un pedido ya enviado a caja.

### Fase 6 — Frontend, UI y diseño de los 2 cambios → `06-frontend-y-diseno-cambios.md`
- Mapa de componentes y de qué API consume cada pantalla (`/`, `/orden/[id]`, `/admin`, Kanban, `/repartidor`, `/perfil`).
- Dónde caben los botones "Cancelar" y "Modificar" para el cliente y para el personal.
- **Propuesta de diseño** de ambos cambios (reglas por estado, endpoints nuevos, cambios de BD si los hay, pruebas) y la lista consolidada de hallazgos con prioridad.

---

## 5. Lo que necesito de ti para arrancar la Fase 1–2

1. **¿Producción está en Azure o en Vercel?** (o ambos).
2. **Acceso a la BD**: ¿me autorizas a conectarme **en modo solo lectura** a la base de Supabase con las credenciales de `.env.local` para volcar el esquema? (Solo `SELECT` sobre `information_schema`/`pg_catalog` y conteos; sin escribir nada.) ¿Es la misma BD que usa el cliente en producción, o hay una de pruebas?
3. ¿Hay entorno de pruebas/staging de Loyverse, o solo el real? (Importante para probar cancelación/reembolso sin afectar las cuentas del cliente.)
4. Preferencia sobre reglas de negocio (se puede decidir en Fase 6): ¿el cliente puede cancelar/modificar solo antes de que cocina empiece (`in_preparation`), o también después?

---

## 6. Estado del análisis (actualizado 2026-10-25) — las 6 fases están completas

| Fase | Documento |
|---|---|
| 1 Infraestructura y despliegue | [01-infraestructura.md](01-infraestructura.md) |
| 2 Base de datos | [02-base-de-datos.md](02-base-de-datos.md) |
| 3 Auth, roles y permisos | [03-auth-roles.md](03-auth-roles.md) |
| 4 Pedidos, pagos y estados | [04-ordenes-y-pagos.md](04-ordenes-y-pagos.md) |
| 5 Loyverse | [05-loyverse.md](05-loyverse.md) |
| 6 Frontend + diseño de Cancelar/Modificar + hallazgos priorizados | [06-frontend-y-diseno-cambios.md](06-frontend-y-diseno-cambios.md) |

Correcciones a este documento tras el análisis: la hipótesis H1 sobre `ready`/`in_transit` era errónea (la migración 12 sí los incluye; ver Fase 2); la cancelación para el personal existe en el backend pero sin botón fuera de `received`; hosting = Vercel (Azure es un vestigio). **Lo más urgente está en la Fase 5, sección 0 (credenciales en repo público).**
