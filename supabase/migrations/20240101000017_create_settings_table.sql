-- Migration 17: Create settings table
-- Tabla de configuración global del sistema (key-value con JSONB)
-- Permite cambiar parámetros operativos sin hacer un nuevo deploy

CREATE TABLE IF NOT EXISTS public.settings (
  key         text        PRIMARY KEY,
  value       jsonb       NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed: Coordenadas del restaurante (Lerdo de Tejada 19, Otumba de Gómez Farías, Méx.)
-- Estas coordenadas se pueden actualizar desde el panel admin sin tocar código.
INSERT INTO public.settings (key, value, description)
VALUES (
  'restaurant_location',
  '{"lat": 19.6997, "lng": -98.7628, "address": "Lerdo de Tejada 19, 55900 Otumba de Gómez Farías, Méx."}',
  'Coordenadas GPS del restaurante. Se usa como punto de origen para calcular distancias de envío.'
)
ON CONFLICT (key) DO NOTHING;

-- Seed: Configuración general de delivery
INSERT INTO public.settings (key, value, description)
VALUES (
  'delivery_config',
  '{"enabled": true, "max_distance_km": 99, "estimated_time_minutes": 45}',
  'Configuración general del servicio de envío a domicilio.'
)
ON CONFLICT (key) DO NOTHING;

-- RLS: Solo admins pueden modificar; lectura pública para el backend
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_read_all"
  ON public.settings FOR SELECT
  USING (true);
