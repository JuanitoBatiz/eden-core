# Fase 1 — Infraestructura, entorno y despliegue

> Fecha: 2026-10-25 · Solo lectura. Ningún valor de secretos aparece en este documento (solo nombres).
> Verificado con: lectura de código, `tsc --noEmit`, `eslint`, `npm audit --omit=dev`, `git log`.

## 1. Resumen ejecutivo

| Tema | Estado |
|---|---|
| Hosting de producción | **Vercel** (confirmado por el dueño). Dominio en `robots.ts`/`sitemap.ts`: `https://www.eden-ensaladas.com`. |
| Azure | **Vestigio**: workflow `.github/workflows/main_eden-menu-prod.yml` sigue activo y se dispara en cada push a `main` (ver H1.1). |
| Base de datos | Supabase, proyecto **EDEN** (ref `mnfblwxxehyvspkhdkos`, según `supabase/.temp/`). |
| POS | Loyverse **real** (no hay entorno de pruebas). |
| SMS/OTP | Twilio Verify (+ SMS directo en un flujo de aprobación de pago). |
| Mapas | Google Maps (clave pública de navegador + clave de servidor). |
| Type-check | `tsc --noEmit` **sin errores**. |
| Lint | **606 problemas** (445 errores, 161 warnings), casi todos `no-explicit-any`. |
| Tests | **Ninguno**. |
| Vulnerabilidades (`npm audit`) | 10: **1 crítica (`next`, dependencia directa)**, 7 altas, 2 moderadas. |

## 2. Stack y versiones

- Node local: v24.12.0 · CI (workflow Azure): Node 22.x
- Next.js **16.2.6** (App Router, sin carpeta `pages/`), React 19.2.4, TypeScript 5.9.3 (`strict: true`)
- Tailwind 4 (`@tailwindcss/postcss`) + `src/app/globals.css` (3 549 líneas)
- `@supabase/supabase-js` ^2.106, `jsonwebtoken` ^9, `bcrypt` ^6, `twilio` ^6, `html5-qrcode`, `qrcode.react`, `lucide-react`
- devDependencies de uso en scripts: `tsx`, `dotenv`, `pg`, `sharp`
- Alias de rutas: `@/*` → `./src/*` (tsconfig). Sin `middleware.ts` ni `proxy.ts`: **no hay protección centralizada de rutas**; cada endpoint se protege a mano con `requireRole()` / `verifyAccessToken()` y `/admin` con `src/app/admin/layout.tsx`.
- Scripts de `package.json`: `dev`, `build`, `start`, `lint` (no hay `test`, `typecheck` ni scripts de BD).
- Nota para cualquier cambio futuro: `AGENTS.md` exige leer `node_modules/next/dist/docs/` antes de escribir código (Next 16 tiene cambios incompatibles; p. ej. existe `proxy.md` en lugar de `middleware`).

## 3. Despliegue

### 3.1 Vercel (producción real)
- Proyecto local enlazado: `.vercel/project.json` → proyecto `eden-menu` (el directorio está ignorado por git).
- **No existe `vercel.json`** en el repo. Implicaciones:
  - Configuración de build/región/funciones es la **por defecto** (o está en el panel de Vercel — no visible desde el código).
  - **No hay cron jobs definidos** (ver sección 6).
- Las variables de entorno de producción viven en el panel de Vercel (no verificables desde el repo; ver sección 4).
- Remoto git: `github.com/JuanitoBatiz/eden-core` (rama `main`). Se asume que Vercel despliega por push a `main` mediante la integración Git — **por confirmar en el panel de Vercel** (no hay evidencia en el repo).

### 3.2 Azure (abandonado, pero activo)
- `.github/workflows/main_eden-menu-prod.yml`: en cada push a `main` hace `npm install` + `npm run build` y luego intenta desplegar a Azure Web App `eden-menu-prod` con un secret `AZUREAPPSERVICE_PUBLISHPROFILE_…`.
- Si ese secret/recurso ya no existe, **cada push produce un workflow fallido** (ruido, correo de fallos). Si todavía existe, hay un segundo despliegue de producción corriendo en paralelo (costo y riesgo de que alguien use esa URL con las mismas credenciales). **Acción sugerida (no ejecutada):** verificar en Azure/GitHub y borrar el workflow y el recurso.
- Además: el workflow sube **todo el directorio** (`path: .`) incluyendo `node_modules` como artefacto, y `npm run test --if-present` no hace nada porque no hay tests.

### 3.3 Rastros de una tercera plataforma
- `src/lib/rateLimit.ts` justifica su diseño "porque Railway corre en una sola instancia". Producción es Vercel (serverless, múltiples instancias, memoria no compartida) → ese limitador en memoria **no es fiable** en producción. Mitigado parcialmente: `/api/sms` usa además una función RPC persistente en Supabase (`otp_register_request`) y solo cae al limitador local si esa RPC falla. Otros usos del limitador local: por revisar en Fase 3.

### 3.4 Servicios externos y sus puntos de contacto
| Servicio | Para qué | Dónde se usa |
|---|---|---|
| Supabase (Postgres + Storage) | BD, comprobantes de pago (bucket), RPCs | casi toda la app (`src/lib/supabase.ts`) |
| Twilio Verify | OTP de login | `api/sms`, `api/auth/verify-otp` |
| Twilio SMS | Aviso al aprobar pago | `api/orders/[id]/approve-payment` (usa `TWILIO_PHONE_NUMBER`) |
| Loyverse API | Recibos, clientes, inventario, lealtad | `src/lib/loyverse.ts`, `src/lib/loyalty.ts`, cron, webhook |
| Google Maps | Autocompletar dirección (navegador), distancia/geocodificación (servidor) | `DeliveryAddressSelector.tsx`, `api/delivery/quote`, `api/orders` |
| GitHub Actions | CI/CD (solo Azure) | ver 3.2 |

## 4. Variables de entorno (solo nombres)

Local: `.env.local` y `.env.vercel` (ambos **ignorados por git**: `.gitignore` tiene `.env*`; `git ls-files` confirma que no están versionados). `.env.vercel` solo contiene `VERCEL_OIDC_TOKEN` (generado por `vercel env pull`; es un token temporal, no es de la app). Plantilla: `.env.example` (versionada).

| Variable | Pública | Para qué | Usada en | ¿En `.env.example`? | ¿En `.env.local`? |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL de Supabase | ~63 sitios (API, layouts, scripts) | Sí | Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Cliente anónimo (lecturas públicas) | `lib/supabase.ts`, `api/benefits` | Sí | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** | Superusuario BD (salta RLS) | ~61 sitios | Sí | Sí |
| `JWT_ACCESS_SECRET` | No | Firma access token | `lib/auth.ts` | Sí | Sí |
| `JWT_REFRESH_SECRET` | No | Firma refresh token | `lib/auth.ts` | Sí | Sí |
| `JWT_QR_SECRET` | No | Firma QR de lealtad ("Eden Pass") | `api/me/qr-token`, `api/qr/validate` | Sí | Sí |
| `LOYVERSE_ACCESS_TOKEN` | No | Token API Loyverse | `lib/loyverse.ts`, `lib/loyalty.ts`, cron, scripts | Sí | Sí |
| `LOYVERSE_STORE_ID` | No | Tienda Loyverse | `lib/loyverse.ts` | Sí | Sí |
| `LOYVERSE_GENERIC_VARIANT_ID` | No | Variante genérica para recibos | `lib/loyverse.ts` | Sí | Sí |
| `LOYVERSE_WEBHOOK_SECRET` | No | HMAC del webhook | `api/webhooks/loyverse` | Sí | Sí |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | No | Credenciales Twilio | `api/sms`, `verify-otp`, `approve-payment` | Sí | Sí |
| `TWILIO_VERIFY_SERVICE_SID` | No | Servicio Verify | `api/sms`, `verify-otp` | **No** (falta) | Sí |
| `TWILIO_PHONE_NUMBER` | No | Remitente SMS de aviso de pago | `approve-payment` | Sí | **No** (falta) |
| `CRON_SECRET` | No | Bearer de los endpoints `/api/cron/*` | 2 rutas cron | Sí | Sí |
| `OWNER_SECRET_CODE` | No | Código para auto-promoverse a owner | `api/auth/upgrade-role` | **No** (falta) | Sí |
| `CASHIER_SECRET_CODE` | No | Código para auto-promoverse a cajero | `api/auth/become-cashier` | **No** (falta) | Sí |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Sí | Maps JS/Places (navegador) | `DeliveryAddressSelector.tsx` | Sí | Sí |
| `GOOGLE_MAPS_SERVER_API_KEY` | No | Distance Matrix/Geocoding | `api/orders`, `api/delivery/quote` | Sí | Sí |
| `OTP_DAILY_CAP` | No | Tope global diario de OTP (def. 150) | `api/sms` | No | No (opcional) |
| `NODE_ENV` | — | Cookies seguras, ocultar `/api/test` | auth, test | — | — |

Observaciones:
- **`.env.example` está desactualizado** (faltan `TWILIO_VERIFY_SERVICE_SID`, `OWNER_SECRET_CODE`, `CASHIER_SECRET_CODE`, `OTP_DAILY_CAP`) y `LAUNCH_GUIDE.md` solo lista 6 variables.
- `.env.local` no tiene `TWILIO_PHONE_NUMBER`: en local el SMS de aviso de pago no puede funcionar (en producción hay que confirmar que exista en Vercel).
- No hay validación de variables al arrancar: todo se lee con `process.env.X || ''` y falla en tiempo de ejecución con mensajes distintos en cada ruta.
- **Riesgo operativo clave para el proyecto:** `.env.local` apunta a la **misma BD y al mismo Loyverse que producción** (el dueño confirmó que no hay entorno de pruebas). Cualquier prueba local con escritura afecta datos reales.

## 5. Calidad de código y herramientas

- **Type-check:** limpio (0 errores).
- **ESLint** (`eslint-config-next` core-web-vitals + typescript): 606 problemas. 307 apariciones de `: any` / `as any` en `src/`; 1 `@ts-ignore` en `next.config.ts` (`allowedDevOrigins`, con IPs LAN personales hardcodeadas: `192.168.22.101`, `192.168.1.90`).
- **Tests:** no existen (ni unitarios, ni e2e). El CI no corre lint ni type-check.
- **`npm audit` (solo producción):** 10 vulnerabilidades. Crítica: `next` (dependencia directa; revisar la versión parcheada compatible con 16.2.x antes de actualizar). Altas: `axios`, `follow-redirects`, `form-data`, `nanoid`, `postcss`, `sharp`, `source-map-js` (mayoría transitivas vía `twilio`/`next`). Moderadas: `qs`, `baseline-browser-mapping`. No se aplicó ningún fix.
- **Headers de seguridad** (`next.config.ts`): CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy (`camera=self, geolocation=self`). Puntos débiles: CSP permite `'unsafe-eval'` y `'unsafe-inline'` en `script-src`. La CSP **no incluye** `connect-src` para Loyverse/Twilio porque se llaman desde el servidor (correcto); sí permite `*.supabase.co` y `*.googleapis.com`.
- **Git:** 94 commits en total, el historial real empieza 2026-09-29 (rifa) con mensajes poco descriptivos (`rifa4`, `pago t`). Árbol limpio al inicio de la sesión; ahora solo difiere por `docs/` (nuestro).
- **Hallazgo de seguridad del repo:** `.env*` ignorado — correcto. Verificar manualmente en GitHub que no se haya subido un `.env` en commits antiguos: `git log --all -- '.env*'` (pendiente de correr en Fase 3, ver abajo).

## 6. Tareas programadas (cron)

Existen dos endpoints diseñados para ser llamados por un cron, ambos protegidos con `Authorization: Bearer $CRON_SECRET`:

| Ruta | Propósito |
|---|---|
| `GET /api/cron/retry-loyverse-sync` | Reintenta trabajos pendientes de `loyverse_sync_queue` (lotes de 10, usa `next_retry_at`). Crea clientes en Loyverse. |
| `GET /api/cron/sync-inventory` | Sincroniza inventario de Loyverse hacia la BD ("fallback" del webhook). |

**Hallazgo (H1.2, importante):** no hay `vercel.json` ni nada en el repo que programe estas llamadas. Si no están configuradas fuera del código (GitHub Actions externo, cron-job.org, Supabase `pg_cron`…), **los reintentos de sincronización con Loyverse nunca se ejecutan**, y los trabajos en cola se quedarían `pending`. Esto afecta directamente "las cuentas no cuadran". Se comprobará en Fase 2 viendo si `loyverse_sync_queue` tiene filas `pending` antiguas y si hay extensión `pg_cron` / jobs en la BD. Además, Vercel Cron envía `Authorization: Bearer $CRON_SECRET` automáticamente si la variable se llama `CRON_SECRET`, por lo que arreglarlo sería agregar un `vercel.json` (plan Hobby limita a 1 ejecución diaria por cron).

## 7. Mapa de carpetas (resumen)

```
eden-menu/
├─ src/app/            Páginas (App Router) + src/app/api/** (≈70 route handlers)
│   ├─ page.tsx        Menú/carrito/checkout (2 330 líneas)
│   ├─ orden/[id]/     Seguimiento del pedido (cliente)
│   ├─ admin/          Panel owner/cajero (Kanban, menú, usuarios, finanzas, rifa…)
│   ├─ repartidor/     Vista del repartidor
│   ├─ perfil, rifa, become-cashier, become-owner
├─ src/components/     UI (admin/*, loyalty/*, DeliveryAddressSelector, etc.)
├─ src/lib/            auth, supabase, loyverse, loyalty, pricing, permissions, rateLimit, menuData
├─ src/hooks/          usePermissions
├─ src/types/          api-contracts.ts
├─ supabase/migrations 19 migraciones (incompletas respecto a la BD real; ver Fase 2)
├─ scripts/            ~40 scripts sueltos (muchos escriben en la BD de producción)
├─ public/             imágenes webp, videos de bienvenida, SVG de plantilla
└─ docs/analysis/      esta documentación
```

Scripts en `scripts/` que **escriben** en la BD usando la service role (no ejecutar sin revisar): `add_new_dishes_db`, `do_update_prices`, `fix_db_names_and_webp`, `refactor_salads_db`, `reorder_categories_db`, `setup_sandwich_modifiers_db`, `swap_burrito_rollito`, `update_client_requests_db`, `update_images_db`, `update_zone_limit`, `update_zones`, `reset_loyverse_customers`, `sync-loyverse`, `recover-loyverse-orders`, `migrate-menu-data`. Los de solo lectura/diagnóstico: `check_prices`, `audit-loyverse-mapping`, `analyze-pos-history`, `extract-pos-insights`, `diagnose-loyverse`, `test_distance`, `test_quote_api`.

## 8. Cómo correr el proyecto localmente

```bash
npm install
npm run dev          # http://localhost:3000  (usa .env.local → BD y Loyverse REALES)
npx tsc --noEmit     # type-check
npx eslint           # lint (hoy: 606 problemas)
```
`LAUNCH_GUIDE.md` describe `supabase db push` y `migrate-menu-data.ts`: **no ejecutar** contra la BD actual (migraciones incompletas / datos reales).

## 9. Hallazgos de esta fase (solo reportados)

| ID | Hallazgo | Severidad |
|---|---|---|
| H1.1 | Workflow de Azure activo en cada push (fallos o segundo despliegue olvidado). Sube `node_modules` como artefacto. | Media |
| H1.2 | Los cron `/api/cron/*` no están programados en el repo; posible cola de Loyverse sin reintentos. | **Alta** (verificar en Fase 2/5) |
| H1.3 | `npm audit`: `next` con vulnerabilidad crítica + 9 más. | **Alta** |
| H1.4 | `rateLimit.ts` diseñado para instancia única (Railway) pero producción es Vercel serverless. | Media |
| H1.5 | Dev y producción comparten BD y Loyverse; no hay entorno de pruebas. | **Alta** (riesgo operativo para los cambios) |
| H1.6 | `.env.example`/`LAUNCH_GUIDE.md` desactualizados; sin validación de env al arranque. | Baja |
| H1.7 | 606 problemas de lint, 307 `any`, 0 tests, CI sin lint/typecheck. | Media |
| H1.8 | Sin `middleware`/`proxy`: autorización por endpoint, fácil olvidar una ruta (se audita en Fase 3). | Media |
| H1.9 | `next.config.ts`: `@ts-ignore` y IPs LAN personales hardcodeadas; CSP con `unsafe-eval`/`unsafe-inline`. | Baja |
| H1.10 | Repo `eden-core` en GitHub; confirmar que sea privado y que no haya `.env` en el historial. | A verificar |

## 10. Estrategia para no afectar Loyverse real (propuesta para las Fases 4–6)

Como no hay Loyverse de pruebas y comparten BD, propongo:
1. **Análisis y desarrollo sin escrituras externas:** código con un "interruptor" de seguridad (`LOYVERSE_DRY_RUN=true` en local) que registra en consola lo que *se habría* enviado a Loyverse en lugar de llamarlo.
2. **Pruebas unitarias de las reglas** (qué estados permiten cancelar/modificar, recálculo de total) con datos simulados, sin red.
3. **Prueba real mínima y controlada al final:** un pedido de $1 / producto de prueba en el POS real, cancelado enseguida, acordado con el cliente y con la caja avisada; o bien probar primero solo estados *previos a `in_preparation`* (que **no tienen recibo en Loyverse**, ya que el recibo se crea al pasar a `in_preparation`). Como el cliente solo podrá cancelar/modificar **antes de preparación**, la mayor parte de la funcionalidad no tocará Loyverse en absoluto — se confirmará en Fase 5.
4. Si el cliente lo permite: crear una segunda cuenta/tienda Loyverse gratuita para staging.

## 11. Pendientes que dejo para fases siguientes
- Fase 2: confirmar jobs `pg_cron`, contenido de `loyverse_sync_queue`, RPC `otp_register_request` y demás funciones que **no están en migraciones**.
- Fase 3: `git log --all -- '.env*'`, usos del limitador en memoria, cobertura de `requireRole` en todas las rutas.
- Pedir al dueño (cuando se pueda): acceso/captura del panel de Vercel (variables de entorno, cron, dominio, plan) para cerrar lo que el código no muestra.
