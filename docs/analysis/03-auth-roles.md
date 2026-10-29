# Fase 3 — Autenticación, roles y permisos

> Fecha: 2026-10-25 · Solo lectura (código). No se probó ningún endpoint contra producción ni se modificó nada.
> Archivos base: `src/lib/auth.ts`, `src/lib/permissions.ts`, `src/lib/rateLimit.ts`, `src/hooks/usePermissions.tsx`, `src/app/api/auth/*`, `src/app/admin/layout.tsx`, `src/app/repartidor/layout.tsx`.

## 1. Resumen

- Login **sin contraseña**: teléfono (10 dígitos, +52) → SMS con Twilio Verify → JWT en cookies httpOnly.
- 3 roles jerárquicos: `customer` < `cashier` < `owner` (columna `users.role`; hoy 94 / 4 / 3 usuarios, todos activos).
- La autorización es **por endpoint** (`requireRole`) y por layout en `/admin` y `/repartidor`. No hay `middleware`/`proxy` global.
- Hay **dos hallazgos graves** (H3.1 y H3.2): dos endpoints permiten obtener rol de cajero/owner con solo un código secreto, sin pasar por OTP.

## 2. Flujo de login

```
1. POST /api/auth/check-phone  → ¿existe el teléfono? (devuelve nombre ofuscado + hash)
2. POST /api/sms               → pide a Twilio Verify enviar el OTP.
                                  Límite persistente en BD: RPC otp_register_request
                                  (cooldown, 3/h y 5/día por teléfono, tope por IP y global 150/día)
3. POST /api/auth/verify-otp   → Twilio Verify valida el código.
                                  Busca/crea fila en `users` (role=customer) y dispara alta en Loyverse
                                  (si falla, encola `customer_create` en loyverse_sync_queue).
                                  Emite access_token (2 h) y refresh_token (30 días) en cookies httpOnly.
4. POST /api/auth/refresh      → con la cookie refresh_token emite ambos tokens nuevos (re-lee rol/activo de BD).
5. POST /api/auth/logout       → borra las dos cookies.
```
- En desarrollo sin Twilio configurado, el código válido es `123456`; en producción sin Twilio responde 503 (correcto).
- Cookies: `httpOnly`, `secure` solo en producción, `sameSite=lax`, `path=/`.
- `JwtPayload`: `{ user_id, phone?, role? }`. Secretos: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (si faltan en producción la app lanza error al iniciar — bien; en dev cae a valores por defecto conocidos).
- `JWT_QR_SECRET` firma el QR de lealtad ("Eden Pass") que el cajero escanea (`/api/me/qr-token`, `/api/qr/validate`).

### 2.1 Cómo se valida cada request (`verifyAccessToken` / `requireRole`)
1. Toma el token de la cookie `access_token` (o `Authorization: Bearer`).
2. Si no existe o expiró, **recurre al `refresh_token`** de la cookie (válido 30 días) y sigue como autenticado sin emitir un token nuevo.
3. Consulta `users.active` y `users.role` en BD (caché en memoria de 15 s por proceso). **El rol efectivo siempre viene de la BD**, no del JWT → cambiar un rol o desactivar a alguien surte efecto en ≤15 s.
4. `requireRole(req, 'X')` compara contra `ROLE_HIERARCHY`; si no alcanza lanza `Error('403: insufficient_permissions')` con `required_role` y `your_role`.

Consecuencias:
- El access token de 2 h es casi decorativo: el refresh token (30 d) autentica por sí solo. No hay revocación de sesiones (stateless); el único corte inmediato es `active=false`.
- Cada ruta convierte el error a 401/403 a su manera (patrón repetido ~40 veces con `catch (authErr: any)`; algunas, como `confirm-receipt`, devuelven siempre 401 aunque sea falta de rol).

## 3. Roles y asignación

| Rol | Cómo se obtiene | Alcance |
|---|---|---|
| `customer` | Automático al verificar OTP | Menú, pedidos propios, perfil, lealtad, rifa |
| `cashier` | (a) `POST /api/auth/become-cashier` con `CASHIER_SECRET_CODE`; (b) un owner lo cambia en `PATCH /api/admin/users/[id]/role` | Kanban de pedidos, aprobar/rechazar pagos, canjes de lealtad, escaneo QR, rifa, reembolsos, repartidor, zonas de entrega (lectura), ubicación |
| `owner` ("admin") | (a) `POST /api/auth/upgrade-role` con `OWNER_SECRET_CODE`; (b) otro owner en `/role`; (c) edición manual en BD | Todo lo anterior + menú, usuarios, banco, zonas (escritura), sync Loyverse |

`PATCH /api/admin/users/[id]/role` valida que el rol sea válido y evita que un owner se quite el rol a sí mismo. Las rutas `deactivate/reactivate` ponen `users.active`.

Páginas: `/admin` y `/repartidor` están protegidas por su `layout.tsx` (server component): leen la cookie `refresh_token`, la verifican y consultan rol/activo en BD; si no alcanza `cashier` redirigen a `/`. (El panel `/admin` completo es accesible a cajero; ciertas pestañas se ocultan en el cliente con `usePermissions`.)

`usePermissions` (cliente) llama `/api/me/permissions` y deriva "capacidades" desde `ROUTE_PERMISSIONS`. **Es solo cosmética**: la seguridad real está en el backend.

## 4. Matriz real de endpoints (auditada con el código, 66 `route.ts`)

Leyenda: C = customer, K = cashier, O = owner, — = sin autenticación.

| Endpoint | Método | Guard |
|---|---|---|
| `/api/menu`, `/api/delivery-zones`, `/api/benefits` | GET | — (público, esperado) |
| `/api/delivery/quote` | POST | — (público; llama a Google Maps, tiene rate limit en memoria) |
| `/api/auth/check-phone`, `/api/sms`, `/api/auth/verify-otp`, `/api/auth/logout` | POST | — |
| `/api/auth/become-cashier` | POST | **— (solo código secreto)** ⚠ H3.1 |
| `/api/auth/upgrade-role` | POST | **código secreto; el JWT es opcional** ⚠ H3.2 |
| `/api/auth/refresh` | POST | refresh cookie |
| `/api/me/*` (addresses, loyalty, orders, qr-token, raffle) | varios | C |
| `/api/me/permissions` | GET | token válido |
| `/api/orders` | POST | C |
| `/api/orders` | GET | K |
| `/api/orders/me`, `/api/orders/[id]` | GET | C (+ propiedad; K/O ven todas) |
| `/api/orders/[id]/confirm-receipt` | POST | C + propiedad |
| `/api/orders/[id]/pay-physical` | PATCH | token válido + propiedad (`user_id`) |
| `/api/orders/[id]/proof` | POST / GET | C (subir, con propiedad) / K (ver) |
| `/api/orders/[id]/status`, `approve-payment`, `reject-payment`, `reset-payment`, `delivery-fee` | PATCH | K |
| `/api/orders/delivery`, `/api/orders/pending-payment` | GET | K |
| `/api/customers`, `/api/customers/[id]/redeem`, `/api/qr/validate` | GET/POST | K |
| `/api/admin/raffle*`, `/api/admin/refunds*`, `/api/admin/finances/*`, `/api/admin/settings/restaurant-location`, `/api/admin/delivery-zones` (GET) | varios | K |
| `/api/admin/{menu,categories,products,variants,modifier*,users*,sync-loyverse}`, `/api/bank-config*`, `/api/admin/delivery-zones` (PUT/POST/DELETE) | varios | O |
| `/api/test` | GET | O en producción, **libre en desarrollo** |
| `/api/cron/*` | GET | `Authorization: Bearer CRON_SECRET` |
| `/api/webhooks/loyverse` | POST | firma HMAC (`LOYVERSE_WEBHOOK_SECRET`) |

Cobertura: todas las rutas sensibles de datos tienen guard. **Discrepancia con `ROUTE_PERMISSIONS`**: el diccionario "fuente de la verdad" solo lista ~35 rutas; faltan decenas (p. ej. `pay-physical`, `confirm-receipt`, `delivery-fee`, `reset-payment`, `admin/raffle`, `admin/refunds`, `admin/finances`, `admin/sync-loyverse`, `delivery-zones`), y cita `PATCH /api/orders/:id` que **no existe**. Las "capacidades" del frontend dependen de ese diccionario incompleto.

**Propiedad de los pedidos (relevante para cancelar/modificar):** el patrón ya existe y es correcto en `confirm-receipt` y `pay-physical` (`order.user_id !== token.user_id → 403`). Cualquier endpoint nuevo de cancelar/modificar por parte del cliente debe copiarlo.

## 5. Rate limiting

- `src/lib/rateLimit.ts`: `Map` en memoria del proceso. Usado en `check-phone` (30/h/IP), `verify-otp` (20/15 min/IP), `become-cashier` y `upgrade-role` (3/30 min/IP), `customers/[id]/redeem`, `delivery/quote` y como respaldo de `/api/sms`.
- En Vercel (serverless, varias instancias que nacen y mueren) **esos límites son prácticamente inexistentes**: cada instancia tiene su propio contador. Los únicos límites fiables son los del RPC `otp_register_request` (persistente en BD) y los de Twilio Verify.
- `getClientIP` toma `x-real-ip` o `x-forwarded-for`; en Vercel es correcto, pero la clave `unknown` agrupa a todos si no hay cabecera.

## 6. Hallazgos (solo reportados, NO corregidos)

| ID | Hallazgo | Severidad |
|---|---|---|
| **H3.1** | **`POST /api/auth/become-cashier` no exige estar autenticado ni verificar el teléfono por OTP.** Con el `CASHIER_SECRET_CODE` + *cualquier* teléfono + nombre, el servidor (a) crea o **modifica** al usuario con ese teléfono a rol `cashier` (si era `owner` lo **degrada**) y (b) **inicia sesión como ese usuario** (cookies). Quien conozca el código (p. ej. un ex-cajero) puede entrar como cualquier usuario existente, incluido un owner o un cliente. El único freno es el rate limit en memoria (ineficaz en Vercel). | **Crítica** |
| **H3.2** | **`POST /api/auth/upgrade-role`**: si no hay sesión válida, el `catch` crea/usa un usuario "Dueño Maestro" (teléfono `0000000000`) y emite tokens de **owner**. Es decir, el `OWNER_SECRET_CODE` por sí solo da acceso total sin login. Además la cookie `access_token` se emite sin `path:'/'`. Comparación del código con `!==` (no constante en tiempo). | **Crítica** |
| H3.3 | `check-phone` devuelve `nameHash = base64(nombre real)` junto al nombre ofuscado: base64 **no es un hash**, se decodifica trivialmente → filtra el nombre completo de cualquier teléfono consultado (con rate limit ineficaz, permite enumerar clientes). | Alta |
| H3.4 | Refresh token de 30 días autentica por sí solo y no se puede revocar; el access token de 2 h no aporta seguridad real. `become-cashier` además emite access token de 15 min (inconsistente con 2 h). | Media |
| H3.5 | Rate limits en memoria ineficaces en Vercel (ver sección 5), incluido el que protege los dos códigos secretos. | Alta (agrava H3.1/H3.2) |
| H3.6 | `verify-otp` no comprueba `users.active` al emitir tokens (se corta después en cada request); no hay vínculo entre el teléfono verificado y el `name` recibido (cualquiera puede registrar un nombre). | Baja |
| H3.7 | `ROUTE_PERMISSIONS` incompleto y con rutas inexistentes; "fuente de la verdad" no refleja el código real. | Media |
| H3.8 | Autorización repetida a mano en ~66 archivos (`catch (authErr: any)` copiado; mensajes y códigos 401/403 inconsistentes; clientes Supabase creados con `createClient` directo en vez de `createAdminClient`). Sin `proxy.ts` ni helper común tipo `withAuth`. | Media (mantenibilidad) |
| H3.9 | `/api/test` queda abierto en desarrollo (aceptable) y consulta datos de lealtad/pedidos del primer usuario. | Baja |
| H3.10 | `users.role` se puede cambiar a mano desde Supabase/SQL; no hay registro de auditoría de cambios de rol, ni de qué cajero hizo qué acción sobre un pedido. | Media |
| H3.11 | Historial de git: `git log --all -- '.env*'` no muestra commits → **no hay `.env` versionados** (ok). | OK |

## 7. Implicaciones para "cancelar / modificar pedido"

1. **Quién puede cancelar:**
   - Cajero/owner: ya posible vía `PATCH /api/orders/[id]/status` (ver Fase 4).
   - Cliente: hay que crear un endpoint propio (p. ej. `POST /api/orders/[id]/cancel`) con `requireRole('customer')` **y** comprobación de `order.user_id === token.user_id` (patrón de `confirm-receipt`), sin reutilizar `/status` (exige cajero).
2. **Ventana permitida:** solo antes de `in_preparation` (decisión del cliente). OJO, hallazgo de `pay-physical`: cuando el cliente elige "pagar en efectivo" el pedido pasa **directo a `in_preparation`** (y se crea el recibo Loyverse en ese instante). Eso implica que la ventana real del cliente es `awaiting_payment` (aún sin elegir cómo pagar) y, si usa transferencia, mientras el comprobante esté pendiente. Se concreta en Fase 4.
3. **Auditoría:** como no se registra quién/cuándo/por qué, la cancelación por cliente debería guardar actor y motivo (campos nuevos o tabla de eventos) — esto va directo a "las cuentas no cuadran".
4. **Atomicidad:** las transiciones hacen `SELECT` y luego `UPDATE` sin condición sobre el estado previo (carrera posible: el cajero pasa a `in_preparation` mientras el cliente cancela). La cancelación debe hacerse con `UPDATE … WHERE status = 'awaiting_payment'` y comprobar filas afectadas.
5. **Roles en UI:** los botones nuevos del cliente van en `/orden/[id]`; no dependen de `usePermissions` (cliente propio), solo del estado del pedido.
