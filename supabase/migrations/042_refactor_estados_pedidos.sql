-- Migration 042: Refactorizar estados de pedidos
-- Crea tabla pedido_estados y migra de CHECK constraint a FK

-- ============================================================
-- 1. Crear tabla pedido_estados
-- ============================================================
CREATE TABLE IF NOT EXISTS pedido_estados (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  slug          TEXT NOT NULL,  -- 'pendiente', 'confirmado', etc
  orden         INT NOT NULL DEFAULT 999,
  color         TEXT DEFAULT 'gray',  -- para UI: 'gray', 'yellow', 'blue', 'green', 'red'
  icono         TEXT DEFAULT '○',     -- '○', '✓', '⚠️', '📦', '🚚', etc
  es_final      BOOLEAN DEFAULT FALSE,  -- true si es terminal (entregado, cancelado, devuelto)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ferreteria_id, slug)
);

ALTER TABLE pedido_estados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pedido_estados_access" ON pedido_estados
  FOR ALL USING (ferreteria_id = mi_ferreteria_id());

-- ============================================================
-- 2. Agregar columna estado_id a pedidos (temporal)
-- ============================================================
ALTER TABLE pedidos ADD COLUMN estado_id UUID REFERENCES pedido_estados(id) ON DELETE RESTRICT;

-- ============================================================
-- 3. Crear función para inicializar estados por ferretería
-- ============================================================
CREATE OR REPLACE FUNCTION inicializar_estados_pedidos(p_ferreteria_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO pedido_estados (ferreteria_id, nombre, slug, orden, color, icono, es_final)
  VALUES
    (p_ferreteria_id, 'Programado',         'programado',         1, 'gray',    '📅', false),
    (p_ferreteria_id, 'Pendiente',          'pendiente',          2, 'yellow',  '○',  false),
    (p_ferreteria_id, 'Confirmado',         'confirmado',         3, 'blue',    '✓',  false),
    (p_ferreteria_id, 'En preparación',     'en_preparacion',     4, 'yellow',  '📦', false),
    (p_ferreteria_id, 'Listo para recojo',  'listo_para_recojo',  5, 'green',   '🏪', false),
    (p_ferreteria_id, 'En camino',          'enviado',            6, 'blue',    '🚚', false),
    (p_ferreteria_id, 'Entregado',          'entregado',          7, 'green',   '✓',  true),
    (p_ferreteria_id, 'Cancelado',          'cancelado',          8, 'red',     '✗',  true),
    (p_ferreteria_id, 'Devuelto',           'devuelto',           9, 'red',     '↩️',  true)
  ON CONFLICT (ferreteria_id, slug) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. Trigger para auto-inicializar estados cuando se crea ferretería
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_inicializar_estados()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM inicializar_estados_pedidos(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ferreteria_init_estados
  AFTER INSERT ON ferreterias
  FOR EACH ROW EXECUTE FUNCTION trigger_inicializar_estados();

-- ============================================================
-- 5. Migración de datos: llenar estado_id desde estado TEXT
-- ============================================================
-- Esta consulta asume que todas las ferreterías ya tienen sus estados inicializados
UPDATE pedidos
SET estado_id = (
  SELECT pe.id
  FROM pedido_estados pe
  WHERE pe.ferreteria_id = pedidos.ferreteria_id
  AND pe.slug = pedidos.estado
)
WHERE estado_id IS NULL;

-- ============================================================
-- 6. Hacer estado_id NOT NULL después de migración
-- ============================================================
-- (Comentado: descomentar después de verificar migración)
-- ALTER TABLE pedidos ALTER COLUMN estado_id SET NOT NULL;

-- ============================================================
-- 7. Crear índice para performance
-- ============================================================
CREATE INDEX idx_pedido_estados_ferreteria ON pedido_estados(ferreteria_id, slug);
CREATE INDEX idx_pedidos_estado_id ON pedidos(ferreteria_id, estado_id);
