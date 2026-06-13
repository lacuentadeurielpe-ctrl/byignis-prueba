-- ═══════════════════════════════════════════════════════════════════
-- 061: Productos Digitales
-- Tabla independiente para productos/servicios que se venden por
-- WhatsApp sin entrega física: archivos, licencias, cursos, servicios.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.productos_digitales (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id    UUID          NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,

  -- Identidad básica
  nombre           TEXT          NOT NULL,
  tipo             TEXT          NOT NULL DEFAULT 'servicio',
    -- 'archivo' | 'licencia' | 'curso' | 'servicio' | 'suscripcion'
  descripcion      TEXT,                          -- descripción interna (solo el dueño)
  precio           NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
  unidad           TEXT          NOT NULL DEFAULT 'unidad',
    -- 'licencia' | 'hora' | 'acceso' | 'cupo' | 'mes' | 'año' | 'unidad'

  -- Para el bot de WhatsApp
  descripcion_bot  TEXT,                          -- pitch de venta que el bot usa al cliente
  campos_requeridos TEXT[]       DEFAULT ARRAY[]::TEXT[],
    -- datos que el bot DEBE recopilar antes de confirmar:
    -- 'email' | 'ruc' | 'nombre_empresa' | 'fecha_preferida' | 'dni' | 'direccion'
  preguntas_frecuentes JSONB     DEFAULT '[]'::JSONB,
    -- [{pregunta: string, respuesta: string}]
  destacado        BOOLEAN       DEFAULT FALSE,    -- bot lo menciona proactivamente

  -- Entrega post-venta
  metodo_entrega   TEXT          DEFAULT 'manual',
    -- 'whatsapp_auto' | 'enlace_publico' | 'manual'
  contenido_entrega TEXT,                          -- URL / clave de acceso / instrucciones
  mensaje_post_venta TEXT,                         -- template WA: puede usar {{nombre}}, {{email}}
  vigencia         TEXT,                           -- '1 año', 'mensual', 'de por vida', etc.

  -- Cupos (cursos/talleres con aforo)
  cupos_totales    INTEGER,                        -- NULL = ilimitado
  cupos_usados     INTEGER       DEFAULT 0,

  -- Fechas para cursos con fecha fija
  fecha_inicio     DATE,
  fecha_fin        DATE,

  -- Estado
  activo           BOOLEAN       DEFAULT TRUE,
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   DEFAULT NOW()
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_productos_digitales_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_productos_digitales_updated_at
  BEFORE UPDATE ON public.productos_digitales
  FOR EACH ROW EXECUTE FUNCTION update_productos_digitales_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_prod_digitales_ferreteria
  ON public.productos_digitales(ferreteria_id);
CREATE INDEX IF NOT EXISTS idx_prod_digitales_activo
  ON public.productos_digitales(ferreteria_id, activo);

-- RLS
ALTER TABLE public.productos_digitales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_aislamiento_digitales"
  ON public.productos_digitales
  USING (ferreteria_id = mi_ferreteria_id());

CREATE POLICY "tenant_insert_digitales"
  ON public.productos_digitales
  FOR INSERT
  WITH CHECK (ferreteria_id = mi_ferreteria_id());
