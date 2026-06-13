-- Tabla para almacenar credenciales y estado de integraciones externas por tenant
CREATE TABLE IF NOT EXISTS public.integraciones_conectadas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL,   -- 'ycloud' | 'nubefact' | 'maps' | 'mercadopago'
  estado        TEXT NOT NULL DEFAULT 'desconectado',  -- 'conectado' | 'pruebas' | 'desconectado'
  conectado_at  TIMESTAMPTZ,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ferreteria_id, tipo)
);

ALTER TABLE public.integraciones_conectadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_integraciones" ON public.integraciones_conectadas
  USING (ferreteria_id = mi_ferreteria_id());

-- Tabla de audit log para eventos de integraciones
CREATE TABLE IF NOT EXISTS public.integracion_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id    UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  integracion_tipo TEXT NOT NULL,
  evento           TEXT NOT NULL,  -- 'conectado' | 'desconectado' | 'error'
  detalle          TEXT,
  usuario_id       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.integracion_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_integracion_logs" ON public.integracion_logs
  USING (ferreteria_id = mi_ferreteria_id());

-- Trigger para updated_at en integraciones_conectadas
CREATE OR REPLACE FUNCTION update_integraciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_integraciones_updated_at
  BEFORE UPDATE ON public.integraciones_conectadas
  FOR EACH ROW EXECUTE FUNCTION update_integraciones_updated_at();
