-- 105: Fundamentos para completar Notas de Crédito/Débito (FASE 1 del plan
-- docs/PLAN_NOTAS_Y_GUIAS_REMISION.md).
--
-- detalle_emision guarda un snapshot exacto de lo que se envió a SUNAT
-- (items ya mapeados a formato Lycet, documento afectado, motivo, cliente).
-- Sin esto, reintentar una NC/ND fallida por infraestructura obligaría a
-- re-derivar los ítems desde el pedido — que pudo cambiar entretanto (otra
-- devolución, otro ajuste). Con el snapshot, el reintento es determinístico:
-- reenvía exactamente lo mismo que se intentó la primera vez.

ALTER TABLE comprobantes
  ADD COLUMN IF NOT EXISTS detalle_emision JSONB;

COMMENT ON COLUMN comprobantes.detalle_emision IS
  'Snapshot del payload enviado a Lycet (NC/ND): items, documento afectado, motivo, cliente. Usado por reintentarEnvio para reconstruir sin re-derivar del pedido.';
