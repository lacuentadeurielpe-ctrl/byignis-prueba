-- Migración: Settings 2.0 - Configuración Centralizada Enterprise

-- 1. Tabla: configuracion_general (almacena config en JSON por módulo)
CREATE TABLE IF NOT EXISTS public.configuracion_general (
  ferreteria_id UUID PRIMARY KEY REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  negocio_config JSONB DEFAULT NULL,           -- {horarios, direcciones, etc}
  bot_config JSONB DEFAULT NULL,               -- {perfil, agentes, complementarios}
  catalogo_config JSONB DEFAULT NULL,          -- {unidades_defecto, tiers}
  delivery_config JSONB DEFAULT NULL,          -- {modo_asignacion}
  finanzas_config JSONB DEFAULT NULL,          -- {politica_credito}
  avanzado_config JSONB DEFAULT NULL,          -- {feature_toggles, politicas}
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla: integraciones_conectadas (tracking estado de integraciones)
CREATE TABLE IF NOT EXISTS public.integraciones_conectadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,                          -- 'ycloud', 'nubefact', 'mercadopago', 'maps', etc.
  estado TEXT NOT NULL DEFAULT 'pendiente',    -- 'conectado', 'error', 'expirado', 'desconectado', 'pendiente'
  conectado_at TIMESTAMP WITH TIME ZONE,
  ultimo_error TEXT,
  ultimo_error_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT NULL,                 -- custom per integration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla: integracion_logs (audit trail de cambios en integraciones)
CREATE TABLE IF NOT EXISTS public.integracion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  integracion_tipo TEXT NOT NULL,              -- 'ycloud', 'nubefact', etc.
  evento TEXT NOT NULL,                        -- 'conectado', 'desconectado', 'token_rotado', 'error', 'test_exitoso'
  detalle TEXT,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_integraciones_conectadas_ferreteria_tipo
  ON public.integraciones_conectadas(ferreteria_id, tipo);
CREATE INDEX IF NOT EXISTS idx_integraciones_conectadas_estado
  ON public.integraciones_conectadas(ferreteria_id, estado);
CREATE INDEX IF NOT EXISTS idx_integracion_logs_ferreteria
  ON public.integracion_logs(ferreteria_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integracion_logs_tipo
  ON public.integracion_logs(integracion_tipo, created_at DESC);

-- RLS Policies
ALTER TABLE public.configuracion_general ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integraciones_conectadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integracion_logs ENABLE ROW LEVEL SECURITY;

-- Policy: configuracion_general - solo dueño puede acceder
DROP POLICY IF EXISTS "config_general_owner" ON public.configuracion_general;
CREATE POLICY "config_general_owner" ON public.configuracion_general FOR ALL
USING (
  ferreteria_id IN (SELECT id FROM public.ferreterias WHERE owner_id = auth.uid())
);

-- Policy: integraciones_conectadas - solo dueño
DROP POLICY IF EXISTS "integraciones_owner" ON public.integraciones_conectadas;
CREATE POLICY "integraciones_owner" ON public.integraciones_conectadas FOR ALL
USING (
  ferreteria_id IN (SELECT id FROM public.ferreterias WHERE owner_id = auth.uid())
);

-- Policy: integracion_logs - solo dueño (read only)
DROP POLICY IF EXISTS "integracion_logs_owner" ON public.integracion_logs;
CREATE POLICY "integracion_logs_owner" ON public.integracion_logs FOR SELECT
USING (
  ferreteria_id IN (SELECT id FROM public.ferreterias WHERE owner_id = auth.uid())
);

-- Trigger para actualizar updated_at en configuracion_general
DROP TRIGGER IF EXISTS trg_configuracion_general_updated_at ON public.configuracion_general;
CREATE TRIGGER trg_configuracion_general_updated_at
BEFORE UPDATE ON public.configuracion_general
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para actualizar updated_at en integraciones_conectadas
DROP TRIGGER IF EXISTS trg_integraciones_updated_at ON public.integraciones_conectadas;
CREATE TRIGGER trg_integraciones_updated_at
BEFORE UPDATE ON public.integraciones_conectadas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
