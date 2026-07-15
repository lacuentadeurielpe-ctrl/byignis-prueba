-- Migración 115: Seguridad anti-devolución infinita en Notas de Crédito
-- Añade `cantidad_devuelta` a items_pedido para rastrear cuántas unidades
-- ya han sido devueltas mediante NC. El backend valida que
-- (cantidad_solicitada + cantidad_devuelta) <= cantidad antes de emitir.

ALTER TABLE public.items_pedido
  ADD COLUMN IF NOT EXISTS cantidad_devuelta NUMERIC NOT NULL DEFAULT 0;

-- Índice para acelerar la suma de devueltos por pedido
CREATE INDEX IF NOT EXISTS idx_items_pedido_cantidad_devuelta
  ON public.items_pedido (pedido_id)
  WHERE cantidad_devuelta > 0;

-- Comentario explicativo
COMMENT ON COLUMN public.items_pedido.cantidad_devuelta IS
  'Unidades devueltas acumuladas mediante Notas de Crédito. No puede superar `cantidad`.';
