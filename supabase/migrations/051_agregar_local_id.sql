-- Migración 051: Agregar local_id FK a pedidos y entregas
-- Relación: cada pedido/entrega se prepara en UN local específico

-- ============================================================
-- Pedidos: agregar local_id
-- ============================================================

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES public.locales_ferreteria(id) ON DELETE RESTRICT;

-- Migrar datos: asignar local principal a pedidos existentes sin local_id
-- Esto garantiza integridad referencial para datos históricos
UPDATE public.pedidos
SET local_id = (
  SELECT id FROM public.locales_ferreteria lf
  WHERE lf.ferreteria_id = public.pedidos.ferreteria_id
    AND lf.es_principal = true
  LIMIT 1
)
WHERE local_id IS NULL
  AND ferreteria_id IN (
    SELECT id FROM public.ferreterias WHERE activo = true
  );

-- Crear índice para búsquedas por local
CREATE INDEX IF NOT EXISTS idx_pedidos_local_id
  ON public.pedidos(local_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_ferreteria_local
  ON public.pedidos(ferreteria_id, local_id);

-- ============================================================
-- Entregas: agregar local_id
-- ============================================================

ALTER TABLE public.entregas
  ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES public.locales_ferreteria(id) ON DELETE RESTRICT;

-- Migrar datos desde pedido relacionado
UPDATE public.entregas e
SET local_id = p.local_id
FROM public.pedidos p
WHERE e.pedido_id = p.id
  AND e.local_id IS NULL;

-- Fallback: si pedido no tiene local_id, asignar principal
UPDATE public.entregas e
SET local_id = (
  SELECT id FROM public.locales_ferreteria lf
  WHERE lf.ferreteria_id = (
    SELECT ferreteria_id FROM public.pedidos WHERE id = e.pedido_id
  )
    AND lf.es_principal = true
  LIMIT 1
)
WHERE local_id IS NULL;

-- Crear índice para búsquedas por local
CREATE INDEX IF NOT EXISTS idx_entregas_local_id
  ON public.entregas(local_id);
CREATE INDEX IF NOT EXISTS idx_entregas_ferreteria_local
  ON public.entregas(ferreteria_id, local_id);

-- ============================================================
-- Verificación de datos
-- ============================================================

-- Comentario: Después de ejecutar esta migración, verificar:
-- SELECT COUNT(*) FROM pedidos WHERE local_id IS NULL; -- debe ser 0
-- SELECT COUNT(*) FROM entregas WHERE local_id IS NULL; -- debe ser 0
-- SELECT COUNT(DISTINCT local_id) FROM pedidos GROUP BY ferreteria_id;
