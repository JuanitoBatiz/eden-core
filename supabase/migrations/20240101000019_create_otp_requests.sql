-- =============================================================================
-- Registro y rate limiting persistente de envíos de OTP (Twilio Verify)
-- =============================================================================
-- Por qué en Postgres: el proyecto corre en Vercel (serverless), donde un Map en
-- memoria no se comparte entre instancias y no limita nada de forma fiable.
-- Cada SMS enviado cuesta dinero, así que el límite debe ser atómico y global.

CREATE TABLE IF NOT EXISTS public.otp_requests (
  id          BIGSERIAL PRIMARY KEY,
  phone       TEXT        NOT NULL,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_requests_phone_created ON public.otp_requests (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_requests_ip_created    ON public.otp_requests (ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_requests_created       ON public.otp_requests (created_at DESC);

-- RLS activado SIN políticas: solo el service role (que ignora RLS) puede acceder.
ALTER TABLE public.otp_requests ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- otp_register_request: decide de forma ATÓMICA si se permite enviar un SMS.
-- Devuelve: 'ok' | 'dedup' | 'phone_limit' | 'ip_limit' | 'global_limit'
--   dedup        -> ya se envió un código a este teléfono hace menos de p_cooldown_s;
--                   el cliente NO debe ver error, solo continuar a capturar el código.
--   Solo cuando devuelve 'ok' se inserta el registro (y se debe llamar a Twilio).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.otp_register_request(
  p_phone           TEXT,
  p_ip              TEXT,
  p_cooldown_s      INT DEFAULT 45,
  p_phone_hour_max  INT DEFAULT 3,
  p_phone_day_max   INT DEFAULT 5,
  p_ip_hour_max     INT DEFAULT 8,
  p_global_day_max  INT DEFAULT 150
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Serializa peticiones concurrentes del mismo teléfono (evita carreras por doble tap)
  PERFORM pg_advisory_xact_lock(hashtext('otp:' || p_phone));

  -- 1. Cooldown / idempotencia
  IF EXISTS (
    SELECT 1 FROM otp_requests
    WHERE phone = p_phone AND created_at > now() - make_interval(secs => p_cooldown_s)
  ) THEN
    RETURN 'dedup';
  END IF;

  -- 2. Límite por teléfono (hora y día)
  SELECT count(*) INTO v_count FROM otp_requests
   WHERE phone = p_phone AND created_at > now() - interval '1 hour';
  IF v_count >= p_phone_hour_max THEN RETURN 'phone_limit'; END IF;

  SELECT count(*) INTO v_count FROM otp_requests
   WHERE phone = p_phone AND created_at > now() - interval '1 day';
  IF v_count >= p_phone_day_max THEN RETURN 'phone_limit'; END IF;

  -- 3. Límite por IP (solo si la IP es conocida)
  IF p_ip IS NOT NULL AND p_ip <> 'unknown' THEN
    SELECT count(*) INTO v_count FROM otp_requests
     WHERE ip = p_ip AND created_at > now() - interval '1 hour';
    IF v_count >= p_ip_hour_max THEN RETURN 'ip_limit'; END IF;
  END IF;

  -- 4. Tope global diario (freno de emergencia contra abuso y gasto descontrolado)
  SELECT count(*) INTO v_count FROM otp_requests
   WHERE created_at > now() - interval '1 day';
  IF v_count >= p_global_day_max THEN RETURN 'global_limit'; END IF;

  INSERT INTO otp_requests (phone, ip) VALUES (p_phone, p_ip);
  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.otp_register_request(TEXT, TEXT, INT, INT, INT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.otp_register_request(TEXT, TEXT, INT, INT, INT, INT, INT) TO service_role;

-- Limpieza opcional (ejecutar manualmente o con pg_cron): conservar 30 días
-- DELETE FROM public.otp_requests WHERE created_at < now() - interval '30 days';
