-- Migration 058: Sistema de crédito por cliente
--
-- CAMBIOS:
--  1. clientes.limite_credito_monto   — tope de deuda total permitido por cliente
--  2. Eliminar repartidores.limite_deuda_monto / limite_deuda_porcentaje
--     (el tope ahora es por cliente, no por pedido ni por repartidor)
--
-- LÓGICA DEL SISTEMA:
--  El crédito disponible de un cliente = limite_credito_monto - SUM(deudas activas/vencidas)
--  Cuando ese disponible es 0 o negativo, el repartidor NO puede generar más deuda para ese cliente.

-- ── clientes ─────────────────────────────────────────────────────────────────

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS limite_credito_monto NUMERIC(10,2) DEFAULT NULL;

COMMENT ON COLUMN public.clientes.limite_credito_monto IS
  'Tope de crédito (deuda total) permitido para este cliente. NULL = sin límite configurado.';

CREATE INDEX IF NOT EXISTS idx_clientes_tiene_limite_credito
  ON public.clientes(ferreteria_id) WHERE limite_credito_monto IS NOT NULL;

-- ── repartidores — eliminar columnas de límite por pedido (reemplazadas por límite por cliente) ──

ALTER TABLE public.repartidores
  DROP COLUMN IF EXISTS limite_deuda_monto,
  DROP COLUMN IF EXISTS limite_deuda_porcentaje;
