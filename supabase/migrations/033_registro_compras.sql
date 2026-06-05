-- Migración 033: Módulo de Registro de Compras (Contabilidad)
-- 1. Crear tabla de secuencias para compras por ferretería
CREATE TABLE IF NOT EXISTS public.secuencias_compra (
  ferreteria_id UUID PRIMARY KEY REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

-- Habilitar RLS en la tabla de secuencias de compra
ALTER TABLE public.secuencias_compra ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para secuencias de compra
CREATE POLICY "Permitir lectura de secuencias_compra a miembros del tenant"
  ON public.secuencias_compra
  FOR SELECT
  USING (ferreteria_id = (SELECT mi_ferreteria_id()));

-- 2. Función para generar el número de compra (COM-00001)
CREATE OR REPLACE FUNCTION public.generar_numero_compra(p_ferreteria_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_contador INTEGER;
  v_prefijo TEXT := 'COM';
BEGIN
  -- Incrementar de forma segura la secuencia de compras del tenant
  INSERT INTO public.secuencias_compra (ferreteria_id, ultimo_numero)
  VALUES (p_ferreteria_id, 1)
  ON CONFLICT (ferreteria_id)
  DO UPDATE SET ultimo_numero = public.secuencias_compra.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_contador;

  RETURN v_prefijo || '-' || LPAD(v_contador::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Crear tabla compras
CREATE TABLE IF NOT EXISTS public.compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  numero_compra TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('formal', 'informal', 'mixta')),
  proveedor_id UUID REFERENCES public.proveedores(id) ON DELETE SET NULL,
  proveedor_nombre TEXT, -- snapshot del nombre del proveedor
  numero_factura TEXT, -- N° Factura (solo formal/mixta)
  fecha_factura DATE,
  ruc_proveedor TEXT, -- RUC del proveedor para libro contable
  razon_social_proveedor TEXT,
  total_bruto NUMERIC(12,2) NOT NULL DEFAULT 0, -- base imponible
  igv NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_neto NUMERIC(12,2) NOT NULL DEFAULT 0, -- total pagado
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'recibida', 'anulada')),
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  
  CONSTRAINT uq_compras_numero_compra_por_ferreteria UNIQUE (ferreteria_id, numero_compra)
);

-- Habilitar RLS en compras
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

-- Política de RLS para compras
CREATE POLICY acceso_compras_por_ferreteria ON public.compras
  FOR ALL
  USING (ferreteria_id = (SELECT mi_ferreteria_id()));

-- 4. Crear tabla items_compra
CREATE TABLE IF NOT EXISTS public.items_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id UUID NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.productos(id) ON DELETE SET NULL,
  nombre_producto TEXT NOT NULL,
  codigo_interno TEXT, -- snapshot del codigo_interno del producto
  es_formal BOOLEAN NOT NULL DEFAULT true,
  tipo_item TEXT NOT NULL CHECK (tipo_item IN ('unitario', 'paquete_a_unidades', 'lote')),
  cantidad_comprada NUMERIC(12,2) NOT NULL DEFAULT 0, -- ej: 5 paquetes
  unidad_compra TEXT NOT NULL, -- ej: 'caja', 'paquete'
  conversion_a_unidades NUMERIC(12,2) DEFAULT 1, -- factor: ej 1 paquete = 12 unidades
  precio_compra_unitario NUMERIC(12,2) NOT NULL DEFAULT 0, -- costo por unidad de compra
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  unidades_ingresadas_al_stock NUMERIC(12,2) NOT NULL DEFAULT 0, -- cantidad_comprada * conversion_a_unidades
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS en items_compra
ALTER TABLE public.items_compra ENABLE ROW LEVEL SECURITY;

-- Política de RLS para items_compra
CREATE POLICY acceso_items_compra ON public.items_compra
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.compras
      WHERE compras.id = items_compra.compra_id
        AND compras.ferreteria_id = (SELECT mi_ferreteria_id())
    )
  );

-- 5. Trigger para asignar número de compra antes de insertar
CREATE OR REPLACE FUNCTION public.trigger_set_numero_compra()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_compra IS NULL THEN
    NEW.numero_compra := public.generar_numero_compra(NEW.ferreteria_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_compras_numero_compra ON public.compras;
CREATE TRIGGER trigger_compras_numero_compra
BEFORE INSERT ON public.compras
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_numero_compra();

-- 6. Trigger para actualizar updated_at en compras
DROP TRIGGER IF EXISTS trigger_update_compras_updated_at ON public.compras;
CREATE TRIGGER trigger_update_compras_updated_at
BEFORE UPDATE ON public.compras
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_compras_ferreteria ON public.compras(ferreteria_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_compra_compra ON public.items_compra(compra_id);
