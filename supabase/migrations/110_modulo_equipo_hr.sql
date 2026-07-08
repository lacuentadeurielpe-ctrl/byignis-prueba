-- Migración 110: Módulo de Equipo, Nóminas y Desempeño

-- 1. Evaluaciones de Desempeño
CREATE TABLE IF NOT EXISTS public.evaluaciones_desempeno (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ferreteria_id UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  local_id UUID REFERENCES public.locales_ferreteria(id) ON DELETE SET NULL,
  
  empleado_id UUID REFERENCES public.miembros_ferreteria(id) ON DELETE CASCADE,
  repartidor_id UUID REFERENCES public.repartidores(id) ON DELETE CASCADE,
  
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  
  puntuacion_global NUMERIC(5,2) CHECK (puntuacion_global >= 0 AND puntuacion_global <= 100),
  metricas JSONB DEFAULT '{}'::jsonb, -- Para almacenar KPIs específicos (ej. entregas_a_tiempo: 95%)
  comentarios TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT chk_evaluacion_target CHECK (
    (empleado_id IS NOT NULL AND repartidor_id IS NULL) OR 
    (empleado_id IS NULL AND repartidor_id IS NOT NULL)
  )
);

-- 2. Nóminas (Ciclos de Pago Grupales)
CREATE TABLE IF NOT EXISTS public.nominas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ferreteria_id UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  local_id UUID REFERENCES public.locales_ferreteria(id) ON DELETE SET NULL,
  
  nombre TEXT NOT NULL, -- ej: "Quincena 1 - Enero 2026"
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  fecha_pago DATE,
  
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'aprobada', 'pagada', 'cancelada')),
  total_bruto NUMERIC(12,2) DEFAULT 0,
  total_deducciones NUMERIC(12,2) DEFAULT 0,
  total_neto NUMERIC(12,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Detalle de Nóminas (Recibo individual por empleado/repartidor)
CREATE TABLE IF NOT EXISTS public.nominas_detalle (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ferreteria_id UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  nomina_id UUID NOT NULL REFERENCES public.nominas(id) ON DELETE CASCADE,
  
  empleado_id UUID REFERENCES public.miembros_ferreteria(id) ON DELETE CASCADE,
  repartidor_id UUID REFERENCES public.repartidores(id) ON DELETE CASCADE,
  
  salario_base NUMERIC(10,2) DEFAULT 0,
  bonos NUMERIC(10,2) DEFAULT 0,
  comisiones NUMERIC(10,2) DEFAULT 0,
  deducciones_adelantos NUMERIC(10,2) DEFAULT 0,
  deducciones_faltas NUMERIC(10,2) DEFAULT 0,
  total_neto NUMERIC(10,2) DEFAULT 0,
  
  metodo_pago TEXT,
  referencia_pago TEXT,
  estado_pago TEXT DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'pagado')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT chk_detalle_target CHECK (
    (empleado_id IS NOT NULL AND repartidor_id IS NULL) OR 
    (empleado_id IS NULL AND repartidor_id IS NOT NULL)
  ),
  UNIQUE(nomina_id, empleado_id),
  UNIQUE(nomina_id, repartidor_id)
);

-- 4. Triggers para updated_at
CREATE OR REPLACE FUNCTION update_nominas_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_evaluaciones_modtime BEFORE UPDATE ON public.evaluaciones_desempeno FOR EACH ROW EXECUTE PROCEDURE update_nominas_updated_at();
CREATE TRIGGER update_nominas_modtime BEFORE UPDATE ON public.nominas FOR EACH ROW EXECUTE PROCEDURE update_nominas_updated_at();
CREATE TRIGGER update_nominas_detalle_modtime BEFORE UPDATE ON public.nominas_detalle FOR EACH ROW EXECUTE PROCEDURE update_nominas_updated_at();

-- 5. RLS y Políticas
ALTER TABLE public.evaluaciones_desempeno ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nominas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nominas_detalle ENABLE ROW LEVEL SECURITY;

-- Políticas Evaluaciones
CREATE POLICY "Dueños y admins ven evaluaciones de su ferretería" ON public.evaluaciones_desempeno
  FOR ALL USING (ferreteria_id = (SELECT auth.jwt()->>'ferreteria_id')::uuid);

-- Políticas Nóminas
CREATE POLICY "Dueños y admins ven nóminas de su ferretería" ON public.nominas
  FOR ALL USING (ferreteria_id = (SELECT auth.jwt()->>'ferreteria_id')::uuid);

-- Políticas Nóminas Detalle
CREATE POLICY "Dueños y admins ven detalles de nóminas de su ferretería" ON public.nominas_detalle
  FOR ALL USING (ferreteria_id = (SELECT auth.jwt()->>'ferreteria_id')::uuid);

-- Indices para rendimiento
CREATE INDEX idx_eval_ferreteria ON public.evaluaciones_desempeno(ferreteria_id);
CREATE INDEX idx_eval_empleado ON public.evaluaciones_desempeno(empleado_id);
CREATE INDEX idx_eval_repartidor ON public.evaluaciones_desempeno(repartidor_id);
CREATE INDEX idx_nominas_ferreteria ON public.nominas(ferreteria_id);
CREATE INDEX idx_nominas_detalle_nomina ON public.nominas_detalle(nomina_id);
CREATE INDEX idx_nominas_detalle_empleado ON public.nominas_detalle(empleado_id);
CREATE INDEX idx_nominas_detalle_repartidor ON public.nominas_detalle(repartidor_id);
