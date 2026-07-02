-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN 098 — Bitácora del intercambio con SUNAT
-- Registra cada envío/consulta a SUNAT (vía Lycet) para poder depurar rechazos
-- después de que ocurren. NUNCA guarda secretos (certificado, clave SOL).
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sunat_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id    UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  comprobante_id   UUID REFERENCES comprobantes(id) ON DELETE SET NULL,

  direccion        TEXT NOT NULL CHECK (direccion IN ('envio','consulta','resumen','baja','test')),
  endpoint         TEXT,                       -- ej: invoice/send, summary/send
  request_resumen  JSONB,                      -- resumen del request SIN secretos
  response_resumen JSONB,                      -- resumen del response / error
  cdr_codigo       TEXT,
  http_status      INTEGER,
  exito            BOOLEAN,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sunat_log_ferreteria
  ON sunat_log (ferreteria_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sunat_log_comprobante
  ON sunat_log (comprobante_id);

ALTER TABLE sunat_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sunat_log_select" ON sunat_log;
DROP POLICY IF EXISTS "sunat_log_insert" ON sunat_log;

CREATE POLICY "sunat_log_select" ON sunat_log
  FOR SELECT USING (ferreteria_id = mi_ferreteria_id());
CREATE POLICY "sunat_log_insert" ON sunat_log
  FOR INSERT WITH CHECK (ferreteria_id = mi_ferreteria_id());
