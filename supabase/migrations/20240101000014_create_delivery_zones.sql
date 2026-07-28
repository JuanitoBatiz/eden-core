-- Migration 14: Create delivery_zones table
-- Tabla de zonas de envío configurable por el admin (sin necesidad de deploy para cambiar tarifas)

CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  label         text          NOT NULL,             -- Ej: "Zona 1 (0-2 km)"
  max_distance_km numeric(6,2) NOT NULL,             -- Distancia máxima de esta zona
  fee           numeric(10,2) NOT NULL,              -- Tarifa en pesos MXN
  active        boolean       NOT NULL DEFAULT true,
  display_order integer       NOT NULL DEFAULT 0,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

-- Seed: Zonas iniciales (ajustables desde panel admin sin deploy)
INSERT INTO public.delivery_zones (label, max_distance_km, fee, display_order) VALUES
  ('Zona 1 (0-2 km)',   2.00,  30.00, 1),
  ('Zona 2 (2-4 km)',   4.00,  40.00, 2),
  ('Zona 3 (4-6 km)',   6.00,  55.00, 3),
  ('Zona 4 (6-8 km)',   8.00,  70.00, 4),
  ('Zona 5 (> 8 km)',  99.00,  85.00, 5);

-- RLS: Solo admins/cashiers pueden modificar zonas; lectura pública para cotización
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_zones_read_all"
  ON public.delivery_zones FOR SELECT
  USING (true);

-- Nota: escritura se hace siempre con adminClient (service_role key), así que no se necesita política de escritura para usuarios normales.
