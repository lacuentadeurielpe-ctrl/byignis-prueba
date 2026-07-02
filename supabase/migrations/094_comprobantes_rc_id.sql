-- Migración 094: vincular boletas con el Resumen Diario que las declaró.
-- Evita que una misma boleta se incluya en dos RCs distintos (duplicado en SUNAT).
ALTER TABLE comprobantes
  ADD COLUMN IF NOT EXISTS rc_id UUID REFERENCES sunat_resumenes_diarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comprobantes_rc_id
  ON comprobantes (rc_id);
