-- Migration 008: Loyalty Benefits and Tiers

-- 1. Tabla de Catálogo de Beneficios (Recompensas canjeables)
CREATE TABLE public.loyalty_benefits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    points_required integer NOT NULL CHECK (points_required > 0),
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loyalty_benefits IS 'Catálogo de recompensas que los clientes pueden canjear usando sus puntos de Loyverse.';

-- Insertar beneficios dummy para demostración
INSERT INTO public.loyalty_benefits (name, description, points_required) VALUES
('Bebida Gratis', 'Refresco o agua fresca de sabor de tamaño mediano', 50),
('Postre Especial', 'Postre del día o galleta gourmet', 120),
('20% de Descuento', 'Descuento en toda tu orden actual', 250);

-- Trigger for updated_at
CREATE TRIGGER update_loyalty_benefits_updated_at 
BEFORE UPDATE ON public.loyalty_benefits 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Tabla de Umbrales de Niveles (Tiers)
CREATE TABLE public.loyalty_tiers (
    tier_name text PRIMARY KEY,
    min_points integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loyalty_tiers IS 'Mapeo de los nombres de los niveles (como se llaman en Loyverse) con sus puntos mínimos para calcular el progreso.';

-- Insertar niveles básicos
INSERT INTO public.loyalty_tiers (tier_name, min_points) VALUES
('Estándar', 0),
('Plata', 300),
('Oro', 1000);

-- 3. Modificar loyalty_redemptions (creada en 007) para apuntar a un beneficio real
ALTER TABLE public.loyalty_redemptions 
ADD COLUMN benefit_id uuid REFERENCES public.loyalty_benefits(id) ON DELETE SET NULL,
ADD COLUMN order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

-- Indexing
CREATE INDEX idx_loyalty_redemptions_benefit ON public.loyalty_redemptions(benefit_id);

-- RLS
ALTER TABLE public.loyalty_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura para beneficios (Público autenticado)
CREATE POLICY "Beneficios son de lectura pública" ON public.loyalty_benefits
    FOR SELECT USING (true);

-- Políticas de lectura para Tiers (Público autenticado)
CREATE POLICY "Tiers son de lectura pública" ON public.loyalty_tiers
    FOR SELECT USING (true);
