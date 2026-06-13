-- ═══════════════════════════════════════════════════════════════════
-- 062: Productos Digitales v2
-- Rediseño completo: categorías, contextualizador IA, multi-entrega,
-- upload de archivos. Se reemplaza el esquema v1.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.productos_digitales
  -- Eliminar columnas v1
  DROP COLUMN IF EXISTS tipo,
  DROP COLUMN IF EXISTS descripcion_bot,
  DROP COLUMN IF EXISTS campos_requeridos,
  DROP COLUMN IF EXISTS preguntas_frecuentes,
  DROP COLUMN IF EXISTS metodo_entrega,
  DROP COLUMN IF EXISTS mensaje_post_venta,
  DROP COLUMN IF EXISTS cupos_totales,
  DROP COLUMN IF EXISTS cupos_usados,
  DROP COLUMN IF EXISTS fecha_inicio,
  DROP COLUMN IF EXISTS fecha_fin,

  -- Agregar columnas v2
  ADD COLUMN IF NOT EXISTS categoria          TEXT          NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS subcategoria       TEXT,
  ADD COLUMN IF NOT EXISTS precio_original    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS stock              INTEGER,
  ADD COLUMN IF NOT EXISTS tags               TEXT[]        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS thumbnail_url      TEXT,
  ADD COLUMN IF NOT EXISTS archivo_url        TEXT,
  ADD COLUMN IF NOT EXISTS tipos_entrega      TEXT[]        NOT NULL DEFAULT '{manual}',
  ADD COLUMN IF NOT EXISTS mensaje_entrega    TEXT,
  ADD COLUMN IF NOT EXISTS contextualizacion  TEXT,
  ADD COLUMN IF NOT EXISTS contextualizacion_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_prod_digitales_categoria
  ON public.productos_digitales(ferreteria_id, categoria);
