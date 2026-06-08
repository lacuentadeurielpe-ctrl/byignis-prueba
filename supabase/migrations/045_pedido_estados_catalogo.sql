-- Migration 045: Catálogo global de estados de pedido (slug PK + FK)
--
-- Factoriza los estados de pedido: reemplaza el CHECK constraint rígido por una
-- tabla catálogo. Agregar/cambiar un estado = 1 INSERT, sin ALTER TABLE ni código.
--
-- `pedidos.estado` SIGUE siendo el slug de texto ('confirmado', etc.) — toda la
-- lógica existente (máquina de estados XState, bot, webhooks) sigue funcionando.
-- Solo cambia que el slug ahora está validado por FK contra el catálogo.
--
-- Reconcilia el diseño per-ferretería equivocado de la migración 042
-- (tabla pedido_estados por ferretería + columna estado_id), que queda superado.

-- 1. Limpiar lo a medio hacer de 042 (columna estado_id + tabla per-ferretería)
ALTER TABLE pedidos DROP COLUMN IF EXISTS estado_id;   -- elimina también pedidos_estado_id_fkey
DROP TABLE IF EXISTS pedido_estados CASCADE;           -- versión per-ferretería

-- 2. Catálogo GLOBAL: slug = clave natural que ya usa todo el sistema
CREATE TABLE pedido_estados (
  slug      TEXT PRIMARY KEY,
  nombre    TEXT NOT NULL,
  orden     INT  NOT NULL,
  color     TEXT NOT NULL,   -- clases tailwind completas para el badge
  icono     TEXT,
  es_final  BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO pedido_estados (slug, nombre, orden, color, icono, es_final) VALUES
  ('programado',        'Programado',        1, 'bg-indigo-100 text-indigo-700', '📅', false),
  ('pendiente',         'Pendiente',         2, 'bg-yellow-100 text-yellow-800', '○',  false),
  ('confirmado',        'Confirmado',        3, 'bg-blue-100 text-blue-800',     '✓',  false),
  ('en_preparacion',    'En preparación',    4, 'bg-orange-100 text-orange-800', '📦', false),
  ('listo_para_recojo', 'Listo para recojo', 5, 'bg-teal-100 text-teal-800',     '🏪', false),
  ('enviado',           'En camino',         6, 'bg-purple-100 text-purple-800', '🚚', false),
  ('entregado',         'Entregado',         7, 'bg-green-100 text-green-800',   '✓',  true),
  ('cancelado',         'Cancelado',         8, 'bg-red-100 text-red-800',       '✗',  true),
  ('devuelto',          'Devuelto',          9, 'bg-red-100 text-red-800',       '↩️', true);

-- 3. RLS: catálogo global de solo-lectura para usuarios autenticados
ALTER TABLE pedido_estados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pedido_estados_read" ON pedido_estados
  FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Normalizar datos y reemplazar el CHECK por una FK
UPDATE pedidos SET estado = 'pendiente'
  WHERE estado IS NULL OR estado NOT IN (SELECT slug FROM pedido_estados);

ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
ALTER TABLE pedidos ALTER COLUMN estado SET DEFAULT 'pendiente';
ALTER TABLE pedidos ADD CONSTRAINT fk_pedidos_estado
  FOREIGN KEY (estado) REFERENCES pedido_estados(slug);

CREATE INDEX IF NOT EXISTS idx_pedidos_estado_fk ON pedidos(estado);
