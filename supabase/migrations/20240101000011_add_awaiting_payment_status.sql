-- Migration: Add awaiting_payment to Orders Status Check Constraint
-- Drop the existing constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Re-add the constraint including 'awaiting_payment'
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('received', 'awaiting_payment', 'in_preparation', 'delivered', 'cancelled'));
