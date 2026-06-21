# Guía de Despliegue y Primer Inicio (MVP Final)

¡Felicidades! El sistema web y backend de Edén Menú está 100% desarrollado y listo para su primera prueba funcional.
Esta guía te llevará paso a paso para encender tu servidor, configurar la base de datos y correr el sistema.

## Paso 0: Prerrequisitos de tu Máquina
Asegúrate de tener instalado en tu computadora:
1. **Node.js** (versión 18 o superior).
2. **NPM** (viene junto con Node.js).
3. Una cuenta en **Supabase** (supabase.com) con un proyecto nuevo creado para Edén.

## Paso 1: Configurar Credenciales (El archivo .env)
En la raíz de este proyecto (donde está el `package.json`), crea un archivo llamado `.env.local` y copia estrictamente la siguiente plantilla rellenando con TUS valores:

```env
# URL de la base de datos Supabase (lo sacas de Supabase -> Project Settings -> API)
NEXT_PUBLIC_SUPABASE_URL=https://tucodigodeproyecto.supabase.co

# La llave pública ANON_KEY (Supabase -> Project Settings -> API)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...

# La llave PRIVADA (Service Role Key). ¡NUNCA COMPARTIR! (Supabase -> Project Settings -> API)
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Secretos para firmar JWT (Inicios de sesión). Puedes inventar cadenas largas.
JWT_ACCESS_SECRET=tu-secreto-acceso-muy-seguro-12345
JWT_REFRESH_SECRET=tu-secreto-refresh-muy-seguro-67890

# Token de Loyverse (Opcional si aún no activas los Puntos de Lealtad en la caja real)
LOYVERSE_ACCESS_TOKEN=tu-token-de-loyverse
```

## Paso 2: Crear Tablas en la Base de Datos
Todo el esquema (Usuarios, Órdenes, Menú, Beneficios) ya está programado en migraciones SQL. Solo necesitas empujarlas a tu base de datos en la nube.
Abre tu terminal en esta carpeta y ejecuta:

1. `npx supabase login` *(te pedirá generar un token en la web de Supabase y pegarlo)*
2. `npx supabase init` *(Si te pregunta algo, dale Enter a todo por defecto)*
3. `npx supabase link --project-ref TU_PROJECT_ID` *(El ID lo sacas de la URL de tu proyecto de Supabase, ej: db.tu_id.supabase.co)*
4. `npx supabase db push` *(Esto creará todas las tablas en menos de 10 segundos)*

## Paso 3: Sembrar el Menú
Tienes un script que inyectará el menú quemado inicial a la base de datos. Esto te ahorrará crear los sándwiches a mano.
Ejecuta:
```bash
npx tsx scripts/migrate-menu-data.ts
```
*(Espera a que termine y diga "Migración completada con éxito")*

## Paso 4: ¡Correr el Sistema!
Ya tienes credenciales, ya tienes tablas y ya tienes menú. Ahora prende el motor.
Instala cualquier librería faltante y arranca el servidor local:
```bash
npm install
npm run dev
```
Abre en tu navegador `http://localhost:3000`.

## ¿Cómo iniciar como Dueño por primera vez?
La primera vez que te registres con tu teléfono y el código de SMS temporal (el que te aparece en pantalla en el letrero amarillo), serás un `customer`.
Para darte permisos de súper-administrador (Dueño):
1. Ve al panel de Supabase en internet.
2. Entra al menú "Table Editor" -> tabla `users`.
3. Busca tu registro de usuario y cambia manualmente el valor de la columna `role` de `customer` a `owner`.
4. Refresca tu pantalla en Localhost, ¡y el panel `/admin` ya será accesible!

¡Éxito en tu prueba!
