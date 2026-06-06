-- Migración: CRM Nativo (Oportunidades y Notas)

-- 1. Tabla de Oportunidades del CRM (Kanban)
CREATE TABLE IF NOT EXISTS public.crm_oportunidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ferreteria_id UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    vendedor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Asignado a
    
    titulo TEXT NOT NULL, -- Ej: "Materiales para Obra San Borja"
    descripcion TEXT,
    estado TEXT NOT NULL DEFAULT 'lead' 
        CHECK (estado IN ('lead', 'negociacion', 'ganado', 'perdido')),
    
    valor_estimado NUMERIC(10, 2) DEFAULT 0.00,
    probabilidad_cierre INTEGER DEFAULT 50 CHECK (probabilidad_cierre >= 0 AND probabilidad_cierre <= 100),
    fecha_cierre_estimada DATE,
    
    -- Si deriva de una cotización específica
    cotizacion_id UUID REFERENCES public.cotizaciones(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para updated_at en oportunidades
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_crm_oportunidades_updated_at ON public.crm_oportunidades;
CREATE TRIGGER trg_crm_oportunidades_updated_at
BEFORE UPDATE ON public.crm_oportunidades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabla de Notas / Bitácora del Cliente (360 Profile)
CREATE TABLE IF NOT EXISTS public.cliente_notas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ferreteria_id UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    autor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Quien escribió la nota
    
    tipo TEXT NOT NULL DEFAULT 'nota' 
        CHECK (tipo IN ('nota', 'llamada', 'reunion', 'whatsapp')),
    contenido TEXT NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_ferreteria_estado ON public.crm_oportunidades(ferreteria_id, estado);
CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_cliente ON public.crm_oportunidades(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_notas_cliente ON public.cliente_notas(cliente_id);

-- 4. RLS (Row Level Security)
ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aislamiento tenant en crm_oportunidades" 
ON public.crm_oportunidades FOR ALL 
USING (
  ferreteria_id IN (SELECT id FROM public.ferreterias WHERE owner_id = auth.uid())
  OR 
  ferreteria_id IN (SELECT ferreteria_id FROM public.miembros_ferreteria WHERE user_id = auth.uid())
);

CREATE POLICY "Aislamiento tenant en cliente_notas" 
ON public.cliente_notas FOR ALL 
USING (
  ferreteria_id IN (SELECT id FROM public.ferreterias WHERE owner_id = auth.uid())
  OR 
  ferreteria_id IN (SELECT ferreteria_id FROM public.miembros_ferreteria WHERE user_id = auth.uid())
);
