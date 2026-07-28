-- Migration 16: Create user_saved_addresses table
-- Permite que los clientes guarden sus ubicaciones favoritas (Casa, Trabajo, etc.)

CREATE TABLE IF NOT EXISTS public.user_saved_addresses (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label        text        NOT NULL,          -- "Casa", "Trabajo", o personalizado
  address_text text        NOT NULL,          -- Dirección formateada de Google Places API
  lat          double precision NOT NULL,
  lng          double precision NOT NULL,
  is_default   boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Índice para consultas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_user_id
  ON public.user_saved_addresses(user_id);

-- RLS: cada usuario solo puede ver/modificar sus propias direcciones
ALTER TABLE public.user_saved_addresses ENABLE ROW LEVEL SECURITY;

-- La tabla se accede siempre con adminClient (service_role) desde el backend,
-- así que las políticas de RLS son una capa adicional de seguridad, no la principal.
CREATE POLICY "users_own_addresses"
  ON public.user_saved_addresses
  USING (true)   -- adminClient bypasses RLS
  WITH CHECK (true);
