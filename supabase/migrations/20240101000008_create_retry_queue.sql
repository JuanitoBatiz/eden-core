-- Migration: Create Loyverse Sync Queue Table

CREATE TABLE public.loyverse_sync_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type text NOT NULL CHECK (entity_type IN ('customer_create')),
    entity_id uuid NOT NULL,
    payload jsonb NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 5,
    next_retry_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'failed_permanent', 'completed')),
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loyverse_sync_queue IS 'Cola asíncrona de reintentos para la API de Loyverse.';

-- Trigger for updated_at
CREATE TRIGGER update_loyverse_sync_queue_updated_at 
BEFORE UPDATE ON public.loyverse_sync_queue 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for the background worker to find pending jobs quickly
CREATE INDEX idx_loyverse_sync_queue_pending ON public.loyverse_sync_queue(status, next_retry_at) WHERE status = 'pending';

-- RLS Setup (Strictly restricted to service_role)
ALTER TABLE public.loyverse_sync_queue ENABLE ROW LEVEL SECURITY;
-- No public access policies.
