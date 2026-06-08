-- Migración 047: Locales/Sucursales de ferreterías con geolocalización

CREATE TABLE IF NOT EXISTS public.locales_ferreteria (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id   UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,

  -- Identidad
  nombre          TEXT NOT NULL,
  codigo          TEXT,
  descripcion     TEXT,

  -- Dirección y ubicación
  direccion       TEXT NOT NULL,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  place_id        TEXT,

  -- Contacto local
  telefono        TEXT,

  -- Horario (puede ser diferente por local)
  horario_apertura TIME,
  horario_cierre   TIME,
  dias_atencion   TEXT[] DEFAULT '{}',

  -- Estado
  es_principal    BOOLEAN NOT NULL DEFAULT FALSE,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_locales_ferreteria_id
  ON public.locales_ferreteria(ferreteria_id);
CREATE INDEX IF NOT EXISTS idx_locales_es_principal
  ON public.locales_ferreteria(ferreteria_id, es_principal);
CREATE INDEX IF NOT EXISTS idx_locales_activo
  ON public.locales_ferreteria(ferreteria_id, activo);

-- RLS
ALTER TABLE public.locales_ferreteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locales_select" ON public.locales_ferreteria
  FOR SELECT USING (ferreteria_id = public.mi_ferreteria_id());

CREATE POLICY "locales_insert" ON public.locales_ferreteria
  FOR INSERT WITH CHECK (ferreteria_id = public.mi_ferreteria_id());

CREATE POLICY "locales_update" ON public.locales_ferreteria
  FOR UPDATE USING (ferreteria_id = public.mi_ferreteria_id());

CREATE POLICY "locales_delete" ON public.locales_ferreteria
  FOR DELETE USING (ferreteria_id = public.mi_ferreteria_id());

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trg_locales_ferreteria_updated_at ON public.locales_ferreteria;
CREATE TRIGGER trg_locales_ferreteria_updated_at
  BEFORE UPDATE ON public.locales_ferreteria
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migración de datos: insertar la dirección actual como local principal
INSERT INTO public.locales_ferreteria (ferreteria_id, nombre, direccion, telefono, es_principal, activo, horario_apertura, horario_cierre, dias_atencion)
SELECT
  f.id,
  'Local Principal',
  COALESCE(f.direccion, 'Por definir'),
  f.telefono_whatsapp,
  TRUE,
  f.activo,
  f.horario_apertura,
  f.horario_cierre,
  f.dias_atencion
FROM public.ferreterias f
WHERE NOT EXISTS (
  SELECT 1 FROM public.locales_ferreteria l
  WHERE l.ferreteria_id = f.id
)
ON CONFLICT DO NOTHING;
