-- Arregla productos_complementarios para soportar ambos catálogos (físico y digital).
--
-- Antes: producto_id y complementario_id tenían FK rígida solo hacia productos(id) —
-- imposible relacionar un producto digital como gatillo o como sugerencia. La API de
-- Settings (bot/complementarios) tampoco coincidía con el esquema real (seleccionaba una
-- columna "orden" inexistente e insertaba sin complementario_id/tipo, ambos NOT NULL),
-- por lo que la tabla quedó siempre vacía y sugerir_complementario nunca pudo sugerir nada.
--
-- La integridad referencial (que el id exista en productos o productos_digitales según
-- corresponda) se valida a nivel de aplicación (API route), ya que un FK no puede apuntar
-- condicionalmente a dos tablas distintas.

ALTER TABLE productos_complementarios
  DROP CONSTRAINT IF EXISTS productos_complementarios_producto_id_fkey;

ALTER TABLE productos_complementarios
  DROP CONSTRAINT IF EXISTS productos_complementarios_complementario_id_fkey;

ALTER TABLE productos_complementarios
  ADD COLUMN IF NOT EXISTS producto_tipo TEXT NOT NULL DEFAULT 'fisico'
    CHECK (producto_tipo IN ('fisico', 'digital')),
  ADD COLUMN IF NOT EXISTS complementario_tipo TEXT NOT NULL DEFAULT 'fisico'
    CHECK (complementario_tipo IN ('fisico', 'digital'));

CREATE INDEX IF NOT EXISTS idx_productos_complementarios_producto
  ON productos_complementarios (ferreteria_id, producto_id, producto_tipo);
