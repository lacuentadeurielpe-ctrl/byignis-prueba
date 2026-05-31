-- Agregar el estado 'programado' a la restricción de estados permitidos de la tabla pedidos.
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check CHECK (estado IN ('programado', 'pendiente', 'confirmado', 'en_preparacion', 'enviado', 'entregado', 'cancelado'));
