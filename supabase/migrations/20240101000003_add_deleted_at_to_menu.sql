-- Añadir columna deleted_at para soft deletes de la gestión de menú

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.variants ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.modifier_groups ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.modifiers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
