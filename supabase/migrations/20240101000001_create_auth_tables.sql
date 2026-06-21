-- Migration: Create Auth Tables (users, otp_sessions)

-- ==============================================================================
-- 1. Tabla: users
-- ==============================================================================
CREATE TABLE public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone text UNIQUE NOT NULL,
    name text,
    role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'cashier', 'owner')),
    loyverse_customer_id text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.users IS 'Tabla principal de usuarios del sistema (clientes y staff). Gestionada por el backend propio de Next.js, no por Supabase Auth nativo.';
COMMENT ON COLUMN public.users.id IS 'Identificador único del usuario (UUIDv4).';
COMMENT ON COLUMN public.users.phone IS 'Número de teléfono con formato E.164 (ej. +521234567890). Usado como identificador principal para el login.';
COMMENT ON COLUMN public.users.name IS 'Nombre completo o de visualización del usuario.';
COMMENT ON COLUMN public.users.role IS 'Rol del usuario en la plataforma. Puede ser customer, cashier u owner.';
COMMENT ON COLUMN public.users.loyverse_customer_id IS 'ID de cliente en Loyverse POS (para sincronización futura en Módulo 6).';
COMMENT ON COLUMN public.users.active IS 'Indica si el usuario está activo o baneado/eliminado lógicamente.';
COMMENT ON COLUMN public.users.created_at IS 'Fecha y hora de creación del registro.';

-- Habilitar RLS en users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- POLÍTICAS RLS (USERS)
-- ==============================================================================
-- IMPORTANTE: Ya que se implementará una tabla manual de 'otp_sessions', esto indica 
-- que el sistema usará autenticación propia (Custom JWT o validación de backend) y 
-- NO el flujo nativo de Supabase Auth (auth.users).
--
-- Por ello, la tabla 'users' no tendrá políticas RLS para acceso público ni autenticado.
-- Esto significa que desde el cliente web (Navegador) NO se puede acceder a esta tabla 
-- bajo ninguna circunstancia. TODO el acceso debe hacerse desde los endpoints de Next.js
-- (/api/*) utilizando la llave SUPABASE_SERVICE_ROLE_KEY, que por diseño ignora el RLS.
-- ==============================================================================


-- ==============================================================================
-- 2. Tabla: otp_sessions
-- ==============================================================================
CREATE TABLE public.otp_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone text NOT NULL,
    otp_hash text NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    expires_at timestamptz NOT NULL,
    consumed boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.otp_sessions IS 'Tabla temporal para manejar las sesiones y hashes de códigos OTP enviados a los usuarios por SMS.';
COMMENT ON COLUMN public.otp_sessions.id IS 'Identificador único de la sesión OTP.';
COMMENT ON COLUMN public.otp_sessions.phone IS 'Número de teléfono al que se envió el código OTP.';
COMMENT ON COLUMN public.otp_sessions.otp_hash IS 'Hash criptográfico del código OTP enviado. Nunca guardar en texto plano.';
COMMENT ON COLUMN public.otp_sessions.attempts IS 'Número de intentos fallidos de validación de este OTP. Máximo sugerido: 5.';
COMMENT ON COLUMN public.otp_sessions.expires_at IS 'Fecha y hora exactas en que este OTP deja de ser válido.';
COMMENT ON COLUMN public.otp_sessions.consumed IS 'Bandera para marcar si este OTP ya fue utilizado con éxito, para invalidarlo y prevenir ataques de replay.';
COMMENT ON COLUMN public.otp_sessions.created_at IS 'Fecha y hora de generación de la sesión OTP.';

-- Índices para optimizar búsquedas
CREATE INDEX idx_otp_sessions_phone ON public.otp_sessions (phone);
CREATE INDEX idx_otp_sessions_expires_at ON public.otp_sessions (expires_at);

-- Habilitar RLS en otp_sessions
ALTER TABLE public.otp_sessions ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- POLÍTICAS RLS (OTP_SESSIONS)
-- ==============================================================================
-- Esta tabla es de uso estrictamente backend y altamente confidencial.
-- Al habilitar RLS sin declarar ninguna política de acceso, denegamos todo acceso
-- (SELECT, INSERT, UPDATE, DELETE) desde el cliente usando la ANON KEY o CUSTOM JWT.
-- Sólo el servidor (usando la SUPABASE_SERVICE_ROLE_KEY) podrá leer y escribir en ella.
-- ==============================================================================
