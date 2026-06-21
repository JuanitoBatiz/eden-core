-- Migration: Create Orders Table

CREATE TABLE public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    customer_email text,
    items jsonb NOT NULL,
    total numeric(10,2) NOT NULL,
    notes text,
    status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'in_preparation', 'delivered')),
    payment_status text NOT NULL DEFAULT 'pending_payment' CHECK (payment_status IN ('pending_payment', 'payment_submitted', 'payment_approved', 'payment_rejected')),
    proof_url text,
    rejection_reason text,
    loyverse_receipt_id text,
    loyverse_receipt_number text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.orders IS 'Órdenes de los clientes. Contiene el ticket de artículos, estados del pedido y del pago.';

-- Trigger for updated_at
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for Admin Panel (Modulo 5)
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);

-- RLS Setup
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- As of now, only the service_role (backend) handles orders. 
-- Clients do not read orders directly from the client-side Supabase SDK, 
-- they go through the Next.js API. So we leave RLS strict (no public policies).
