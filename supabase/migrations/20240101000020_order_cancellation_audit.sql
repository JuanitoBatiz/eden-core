-- Migration: auditoría de cancelaciones y reemplazo de pedidos
-- Aditiva: todas las columnas son NULLables y no alteran filas ni constraints existentes.
-- Orden de despliegue: ejecutar ESTE SQL primero, después desplegar el código que lo usa.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancelled_at         timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by         text,   -- 'customer' | 'staff' | 'pos' | 'system'
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancel_reason        text,   -- el webhook de Loyverse ya espera esta columna
  ADD COLUMN IF NOT EXISTS replaces_order_id    uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replaced_by_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_cancelled_by_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_cancelled_by_check
  CHECK (cancelled_by IS NULL OR cancelled_by IN ('customer', 'staff', 'pos', 'system'));

CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at
  ON public.orders(cancelled_at) WHERE cancelled_at IS NOT NULL;

COMMENT ON COLUMN public.orders.cancelled_by IS 'Quién canceló: customer, staff, pos (anulado en Loyverse) o system.';
COMMENT ON COLUMN public.orders.replaces_order_id IS 'Si el pedido nació de "Modificar pedido", id del pedido que reemplaza.';
