-- Migration 18: Add composite index for delivery orders
-- Mejora drásticamente el rendimiento del Dashboard del Repartidor (polling 30s)

CREATE INDEX IF NOT EXISTS idx_orders_delivery_status
ON public.orders (service_type, status)
WHERE service_type = 'delivery';
