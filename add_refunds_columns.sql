-- Script para añadir funcionalidad de reembolsos a la tabla 'orders'

-- 1. Agregar las columnas necesarias
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS refund_status text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS refund_proof_url text;

-- 2. Asegurar que las políticas de Storage permiten acceder/subir a una nueva carpeta o la misma
-- (Asumiendo que usarán el mismo bucket 'payment_proofs' para los comprobantes de reembolso,
-- no se requiere SQL adicional si ya existe la política de admin/authenticated).
