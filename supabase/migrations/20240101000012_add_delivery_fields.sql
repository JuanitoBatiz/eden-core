-- Migration: Add Delivery Fields to Orders Table

-- Add service_type and delivery_address
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS service_type text DEFAULT 'pickup' CHECK (service_type IN ('pickup', 'delivery'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address text;

-- Drop the existing constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Re-add the constraint including 'ready' and 'in_transit'
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('received', 'awaiting_payment', 'in_preparation', 'ready', 'in_transit', 'delivered', 'cancelled'));
