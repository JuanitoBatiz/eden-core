-- Migration: Add delivery_fee fields to orders table
-- Run this in Supabase SQL Editor: https://app.supabase.com → SQL Editor

-- Add delivery_fee: NULL = pendiente de cotizar, NUMBER = tarifa confirmada
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) DEFAULT NULL;

-- Add delivery_fee_confirmed: false until admin explicitly sets the fee
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

-- For existing pickup orders, mark fee as confirmed (not applicable)
UPDATE public.orders 
SET delivery_fee_confirmed = TRUE 
WHERE service_type = 'pickup' OR service_type IS NULL;
