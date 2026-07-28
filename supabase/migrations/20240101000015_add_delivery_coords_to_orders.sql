-- Migration 15: Add GPS coordinates and zone reference to orders table
-- Extiende la tabla existente con campos para el sistema de envío por coordenadas

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_lat          double precision,
  ADD COLUMN IF NOT EXISTS delivery_lng          double precision,
  ADD COLUMN IF NOT EXISTS delivery_distance_km  numeric(6,2),
  ADD COLUMN IF NOT EXISTS delivery_zone_id      uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL;

-- Comentarios descriptivos para el equipo
COMMENT ON COLUMN public.orders.delivery_lat         IS 'Latitud GPS del destino de entrega (null para pickup/dine_in)';
COMMENT ON COLUMN public.orders.delivery_lng         IS 'Longitud GPS del destino de entrega (null para pickup/dine_in)';
COMMENT ON COLUMN public.orders.delivery_distance_km IS 'Distancia en km calculada por el servidor desde el restaurante al cliente';
COMMENT ON COLUMN public.orders.delivery_zone_id     IS 'Referencia a la zona de entrega que aplicó al cotizar';
