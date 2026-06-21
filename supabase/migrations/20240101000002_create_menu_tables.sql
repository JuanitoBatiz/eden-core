-- Migration: Create Menu Tables

CREATE TABLE public.categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    icon text,
    display_order integer NOT NULL DEFAULT 0,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.categories IS 'Categorías principales del menú (ej. Ensaladas, Jugos).';

CREATE TABLE public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    base_price numeric(10,2) NOT NULL DEFAULT 0,
    image_url text,
    available boolean NOT NULL DEFAULT true,
    loyverse_item_id text,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.products IS 'Productos individuales que pertenecen a una categoría. base_price es el precio si no tiene variantes de tamaño.';

CREATE TABLE public.variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    name text NOT NULL,
    price numeric(10,2) NOT NULL,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.variants IS 'Variantes de tamaño o presentación de un producto (ej. Chico, Grande). Su precio reemplaza al base_price del producto.';

CREATE TABLE public.modifier_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    name text NOT NULL,
    min_selection integer NOT NULL DEFAULT 0,
    max_selection integer,
    free_limit integer NOT NULL DEFAULT 0,
    extra_price numeric(10,2) NOT NULL DEFAULT 0,
    required boolean NOT NULL DEFAULT false,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.modifier_groups IS 'Grupos de opciones para un producto (ej. Proteínas, Toppings). free_limit dicta cuántos se incluyen gratis, y extra_price dicta el costo de cada uno adicional.';

CREATE TABLE public.modifiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    modifier_group_id uuid REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    name text NOT NULL,
    price_modifier numeric(10,2) NOT NULL DEFAULT 0,
    available boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.modifiers IS 'Las opciones individuales dentro de un grupo (ej. Pollo asado, Fresa). price_modifier se usa sólo si este ingrediente en específico es más caro (hoy no se usa, se asume 0 y se cobra el extra_price del grupo).';

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_variants_updated_at BEFORE UPDATE ON public.variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_modifier_groups_updated_at BEFORE UPDATE ON public.modifier_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_modifiers_updated_at BEFORE UPDATE ON public.modifiers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Setup
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;

-- Lectura pública para registros disponibles/activos
CREATE POLICY "Permitir lectura pública de categorías activas" ON public.categories FOR SELECT USING (active = true);
CREATE POLICY "Permitir lectura pública de productos disponibles" ON public.products FOR SELECT USING (available = true);
CREATE POLICY "Permitir lectura pública de variantes" ON public.variants FOR SELECT USING (true);
CREATE POLICY "Permitir lectura pública de modifier_groups" ON public.modifier_groups FOR SELECT USING (true);
CREATE POLICY "Permitir lectura pública de modifiers disponibles" ON public.modifiers FOR SELECT USING (available = true);

-- Las políticas de INSERT/UPDATE/DELETE no se definen para anon.
-- El admin/backend usará service_role_key que bypassa RLS.
