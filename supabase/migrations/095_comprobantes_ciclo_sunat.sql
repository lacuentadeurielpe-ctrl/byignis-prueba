-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN 095 — Ciclo de vida SUNAT en comprobantes
-- Modela el estado real del comprobante ante SUNAT (antes solo emitido/anulado/error),
-- fecha de emisión fiscal (separada de created_at), moneda y tipo de cambio.
-- Reusa las columnas ya existentes sunat_cdr_codigo / sunat_cdr_descripcion.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE comprobantes
  ADD COLUMN IF NOT EXISTS estado_sunat  TEXT,               -- ciclo real SUNAT (NULL = doc interno, no aplica)
  ADD COLUMN IF NOT EXISTS cdr_notas     JSONB,              -- observaciones SUNAT (CDR notes), si las hay
  ADD COLUMN IF NOT EXISTS cdr_zip_url   TEXT,               -- CDR .zip archivado para respaldo/depuración
  ADD COLUMN IF NOT EXISTS fecha_emision DATE,               -- fecha fiscal de emisión (para RC y libros)
  ADD COLUMN IF NOT EXISTS moneda        TEXT NOT NULL DEFAULT 'PEN',
  ADD COLUMN IF NOT EXISTS tipo_cambio   NUMERIC(8,3);       -- si moneda <> PEN

-- CHECK moneda
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'comprobantes' AND constraint_name = 'comprobantes_moneda_check'
  ) THEN
    ALTER TABLE comprobantes
      ADD CONSTRAINT comprobantes_moneda_check CHECK (moneda IN ('PEN','USD'));
  END IF;
END $$;

-- CHECK estado_sunat (NULL permitido: documentos internos como nota_venta no van a SUNAT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'comprobantes' AND constraint_name = 'comprobantes_estado_sunat_check'
  ) THEN
    ALTER TABLE comprobantes
      ADD CONSTRAINT comprobantes_estado_sunat_check
        CHECK (estado_sunat IS NULL OR estado_sunat IN
          ('borrador','enviado','aceptado','aceptado_obs','rechazado','anulado','baja'));
  END IF;
END $$;

-- Backfill fecha_emision desde created_at en zona Lima (UTC-5)
UPDATE comprobantes
   SET fecha_emision = (created_at AT TIME ZONE 'America/Lima')::date
 WHERE fecha_emision IS NULL;

-- Backfill estado_sunat solo para documentos que SÍ van a SUNAT
UPDATE comprobantes
   SET estado_sunat = CASE
     WHEN estado = 'anulado' THEN 'anulado'
     WHEN estado = 'error'   THEN 'rechazado'
     WHEN sunat_cdr_codigo ~ '^[0-9]+$' AND sunat_cdr_codigo::int >= 4000 THEN 'aceptado_obs'
     WHEN estado = 'emitido' THEN 'aceptado'
     ELSE 'borrador'
   END
 WHERE estado_sunat IS NULL
   AND tipo IN ('boleta','factura','nota_credito','nota_debito');

CREATE INDEX IF NOT EXISTS idx_comprobantes_fecha_emision
  ON comprobantes (ferreteria_id, fecha_emision);
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado_sunat
  ON comprobantes (ferreteria_id, estado_sunat);
