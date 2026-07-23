-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN 119 — Variantes de producto (Tallas, Colores, etc.)
-- ══════════════════════════════════════════════════════════════════

-- 1. Flag en tabla productos
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS tiene_variantes BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.productos.tiene_variantes IS
  'Indica si el producto utiliza variantes (tallas, colores, etc.) con precio y stock propios.';

-- 2. Tabla producto_atributos
CREATE TABLE IF NOT EXISTS public.producto_atributos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  producto_id   UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  orden         INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prod_attrs_producto ON public.producto_atributos(producto_id);
CREATE INDEX IF NOT EXISTS idx_prod_attrs_ferreteria ON public.producto_atributos(ferreteria_id);

-- 3. Tabla atributo_valores
CREATE TABLE IF NOT EXISTS public.atributo_valores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atributo_id UUID NOT NULL REFERENCES public.producto_atributos(id) ON DELETE CASCADE,
  valor       TEXT NOT NULL,
  color_hex   TEXT,
  orden       INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_attr_values_atributo ON public.atributo_valores(atributo_id);

-- 4. Tabla variantes_producto
CREATE TABLE IF NOT EXISTS public.variantes_producto (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id   UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  producto_id     UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  sku             TEXT,
  nombre_variante TEXT NOT NULL,
  precio          NUMERIC(10,2),
  precio_compra   NUMERIC(10,2),
  stock           INT NOT NULL DEFAULT 0,
  stock_minimo    INT DEFAULT 0,
  imagen_url      TEXT,
  activo          BOOLEAN DEFAULT true,
  venta_sin_stock BOOLEAN DEFAULT false,
  valores_ids     UUID[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_variantes_producto ON public.variantes_producto(producto_id);
CREATE INDEX IF NOT EXISTS idx_variantes_ferreteria ON public.variantes_producto(ferreteria_id);

-- 5. RLS
ALTER TABLE public.producto_atributos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atributo_valores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variantes_producto ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'producto_atributos' AND policyname = 'producto_atributos_all') THEN
    CREATE POLICY producto_atributos_all ON public.producto_atributos FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'atributo_valores' AND policyname = 'atributo_valores_all') THEN
    CREATE POLICY atributo_valores_all ON public.atributo_valores FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'variantes_producto' AND policyname = 'variantes_producto_all') THEN
    CREATE POLICY variantes_producto_all ON public.variantes_producto FOR ALL USING (true);
  END IF;
END $$;

-- 6. Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_variantes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_variantes_updated_at ON public.variantes_producto;
CREATE TRIGGER set_variantes_updated_at
  BEFORE UPDATE ON public.variantes_producto
  FOR EACH ROW EXECUTE FUNCTION public.update_variantes_updated_at();

-- 7. Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'variantes_producto'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.variantes_producto;
  END IF;
END $$;

-- 8. Columnas variante_id y nombre_variante en items_pedido e items_cotizacion
ALTER TABLE public.items_pedido
  ADD COLUMN IF NOT EXISTS variante_id UUID REFERENCES public.variantes_producto(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nombre_variante TEXT;

ALTER TABLE public.items_cotizacion
  ADD COLUMN IF NOT EXISTS variante_id UUID REFERENCES public.variantes_producto(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nombre_variante TEXT;


