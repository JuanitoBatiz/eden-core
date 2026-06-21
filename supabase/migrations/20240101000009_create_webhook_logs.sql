-- Migration: Create Webhook Logs and Loyalty Redemptions

-- 1. Tabla para bitácora de Webhooks
CREATE TABLE public.webhook_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    processed_at timestamptz,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'error', 'ignored')),
    error_details text,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.webhook_logs IS 'Bitácora de eventos recibidos por webhook desde servicios externos (Loyverse, etc.).';

-- 2. Tabla para bitácora de canjes manuales (Lealtad)
CREATE TABLE public.loyalty_redemptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    cashier_id uuid NOT NULL REFERENCES public.users(id), -- Quién autorizó el canje
    benefit_description text NOT NULL,
    points_used integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loyalty_redemptions IS 'Registro interno de recompensas entregadas al cliente usando puntos, debido a limitación de API v1.0 Loyverse.';

-- Indexing for performance
CREATE INDEX idx_webhook_logs_status ON public.webhook_logs(status);
CREATE INDEX idx_loyalty_redemptions_user ON public.loyalty_redemptions(user_id);

-- RLS setup (Strict service_role only or admins)
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;
