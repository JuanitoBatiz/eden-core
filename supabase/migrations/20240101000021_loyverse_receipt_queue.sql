-- Migration: reintento automático de recibos de Loyverse
-- Aditiva. Ejecutar ANTES de desplegar el código que la usa.

-- 1) La cola acepta trabajos 'receipt_create' además de 'customer_create'
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.loyverse_sync_queue'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%entity_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.loyverse_sync_queue DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.loyverse_sync_queue
  ADD CONSTRAINT loyverse_sync_queue_entity_type_check
  CHECK (entity_type IN ('customer_create', 'receipt_create'));

-- 2) Un solo trabajo activo (pendiente o en proceso) por entidad y tipo → evita duplicados en la cola
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyverse_queue_active_job
  ON public.loyverse_sync_queue (entity_type, entity_id)
  WHERE status IN ('pending', 'processing');

-- 3) Candado por pedido para no crear dos recibos a la vez
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS loyverse_sync_started_at timestamptz;

COMMENT ON COLUMN public.orders.loyverse_sync_started_at IS
  'Candado temporal mientras se crea el recibo en Loyverse (NULL = libre). Un valor viejo indica una ejecución que murió.';
