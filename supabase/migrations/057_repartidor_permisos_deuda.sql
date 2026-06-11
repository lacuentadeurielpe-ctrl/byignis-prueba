-- Migration 057: Permisos de cobro parcial (deuda) para repartidores
-- + columnas de confirmación de pago en pedidos
--
-- PROBLEMA: La ruta PATCH /api/delivery/[token]/pedido/[pedidoId] seleccionaba
-- repartidores.puede_registrar_deuda, que no existía → query fallaba → 401 →
-- "Error al registrar entrega" en el portal del repartidor.
--
-- Esta migración añade:
--  - repartidores.puede_registrar_deuda  — toggle de permiso
--  - repartidores.limite_deuda_monto     — máximo S/ de deuda que puede crear
--  - repartidores.limite_deuda_porcentaje — máximo % del pedido que puede quedar sin cobrar
--  - pedidos.pago_confirmado_at          — cuándo se confirmó el pago completo
--  - pedidos.pago_confirmado_por         — quién confirmó (repartidor, dashboard, etc.)
--
-- cobrado_monto y cobrado_metodo se añaden IF NOT EXISTS por compatibilidad.

-- ── repartidores ────────────────────────────────────────────────────────────

ALTER TABLE public.repartidores
  ADD COLUMN IF NOT EXISTS puede_registrar_deuda  BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS limite_deuda_monto      NUMERIC(10,2)         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS limite_deuda_porcentaje INTEGER               DEFAULT NULL
    CONSTRAINT check_limite_pct CHECK (
      limite_deuda_porcentaje IS NULL
      OR (limite_deuda_porcentaje >= 1 AND limite_deuda_porcentaje <= 100)
    );

COMMENT ON COLUMN public.repartidores.puede_registrar_deuda IS
  'Si true, el repartidor puede entregar con cobro parcial (genera deuda automática)';

COMMENT ON COLUMN public.repartidores.limite_deuda_monto IS
  'Máximo S/ de deuda que puede crear por pedido. NULL = sin límite monetario.';

COMMENT ON COLUMN public.repartidores.limite_deuda_porcentaje IS
  'Máximo % del total del pedido que puede quedar como deuda (1-100). NULL = sin límite porcentual.';

-- ── pedidos — columnas de cobro del repartidor ──────────────────────────────

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS cobrado_monto       NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cobrado_metodo      TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pago_confirmado_at  TIMESTAMPTZ   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pago_confirmado_por TEXT          DEFAULT NULL;

COMMENT ON COLUMN public.pedidos.cobrado_monto IS
  'Monto cobrado en efectivo/Yape por el repartidor al momento de la entrega';

COMMENT ON COLUMN public.pedidos.cobrado_metodo IS
  'Método usado en el cobro contraentrega: efectivo, yape, transferencia, etc.';

COMMENT ON COLUMN public.pedidos.pago_confirmado_at IS
  'Timestamp en que el pago quedó marcado como completo';

COMMENT ON COLUMN public.pedidos.pago_confirmado_por IS
  'Quién confirmó el pago: repartidor:<nombre>, dashboard:<userId>, etc.';

-- Índice para búsquedas de deuda por repartidor habilitado
CREATE INDEX IF NOT EXISTS idx_repartidores_puede_deuda
  ON public.repartidores(ferreteria_id, puede_registrar_deuda);
