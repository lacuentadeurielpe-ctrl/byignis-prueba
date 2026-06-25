-- 086_indices_fk_faltantes.sql
-- Índices FK críticos que faltaban en tablas de alto tráfico.
-- Sin estos, cada carga de pedido/cotización hace full table scan en items_*.

-- ── items_pedido ─────────────────────────────────────────────────────────────
-- Toda carga de pedido hace: SELECT * FROM items_pedido WHERE pedido_id = $1
CREATE INDEX IF NOT EXISTS idx_items_pedido_pedido_id
  ON public.items_pedido (pedido_id);

CREATE INDEX IF NOT EXISTS idx_items_pedido_producto_id
  ON public.items_pedido (producto_id);

-- ── items_cotizacion ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_items_cotizacion_cotizacion_id
  ON public.items_cotizacion (cotizacion_id);

CREATE INDEX IF NOT EXISTS idx_items_cotizacion_producto_id
  ON public.items_cotizacion (producto_id);

-- ── pedidos — FKs opcionales sin índice ──────────────────────────────────────
-- Historial por cliente y pedidos por repartidor son queries frecuentes
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id
  ON public.pedidos (ferreteria_id, cliente_id)
  WHERE cliente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_repartidor_id
  ON public.pedidos (ferreteria_id, repartidor_id)
  WHERE repartidor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_cotizacion_id
  ON public.pedidos (cotizacion_id)
  WHERE cotizacion_id IS NOT NULL;

-- ── abonos_credito ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_abonos_credito_credito_id
  ON public.abonos_credito (credito_id);

-- ── recargas_creditos — billing page sin filtro por ferreteria ────────────────
CREATE INDEX IF NOT EXISTS idx_recargas_creditos_ferreteria
  ON public.recargas_creditos (ferreteria_id, created_at DESC);

-- ── rendiciones ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rendiciones_ferreteria
  ON public.rendiciones (ferreteria_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rendiciones_repartidor
  ON public.rendiciones (ferreteria_id, repartidor_id);

-- ── ferreterias — join frecuente con planes en superadmin ────────────────────
CREATE INDEX IF NOT EXISTS idx_ferreterias_plan_id
  ON public.ferreterias (plan_id)
  WHERE plan_id IS NOT NULL;

-- ── suscripciones — join con planes ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_suscripciones_plan_id
  ON public.suscripciones (plan_id)
  WHERE plan_id IS NOT NULL;

-- ── movimientos_creditos — FK conversacion_id frecuente en detalle tenant ─────
CREATE INDEX IF NOT EXISTS idx_movimientos_creditos_conversacion
  ON public.movimientos_creditos (conversacion_id)
  WHERE conversacion_id IS NOT NULL;
