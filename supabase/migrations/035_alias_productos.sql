-- Migración 035: Tabla de Alias de Productos para la memoria de matching en compras inteligentes
CREATE TABLE IF NOT EXISTS public.alias_productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  confianza NUMERIC(3,2) DEFAULT 1.00,
  veces_usado INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  
  CONSTRAINT uq_alias_por_ferreteria UNIQUE (ferreteria_id, alias)
);

-- Habilitar RLS en alias_productos
ALTER TABLE public.alias_productos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para alias_productos
CREATE POLICY acceso_alias_productos ON public.alias_productos
  FOR ALL
  USING (ferreteria_id = (SELECT mi_ferreteria_id()));

-- Índice para búsquedas rápidas por alias en la ferretería
CREATE INDEX IF NOT EXISTS idx_alias_productos_lookup ON public.alias_productos (ferreteria_id, alias);
