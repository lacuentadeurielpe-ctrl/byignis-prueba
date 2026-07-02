-- Migración 093: tabla para Resúmenes Diarios de Boletas (RC) enviados a SUNAT
-- SUNAT exige declarar las boletas del día mediante un RC.
-- El RC es asíncrono: SUNAT devuelve un ticket que se consulta después para obtener el CDR.
CREATE TABLE IF NOT EXISTS sunat_resumenes_diarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id   UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,

  -- Fecha de las boletas incluidas (no la fecha de envío del RC)
  fecha           DATE NOT NULL,

  -- Correlativo del RC para ese día (RC-YYYYMMDD-{correlativo})
  correlativo     INTEGER NOT NULL DEFAULT 1,

  -- Ticket asíncrono devuelto por SUNAT al recibir el RC
  ticket          TEXT,

  -- Estado: 'enviado' → esperando CDR; 'aceptado' → CDR código 0; 'rechazado' → error SUNAT
  estado          TEXT NOT NULL DEFAULT 'enviado'
                    CHECK (estado IN ('enviado', 'aceptado', 'rechazado', 'error')),

  cdr_codigo      TEXT,
  cdr_descripcion TEXT,

  -- Resumen de lo incluido
  boletas_count   INTEGER NOT NULL DEFAULT 0,
  boletas_total   NUMERIC(12, 2) NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consultado_at   TIMESTAMPTZ
);

-- Solo puede existir un RC con el mismo correlativo por día por ferretería
CREATE UNIQUE INDEX IF NOT EXISTS sunat_rc_ferreteria_fecha_corr
  ON sunat_resumenes_diarios (ferreteria_id, fecha, correlativo);

-- RLS: el tenant solo ve sus propios RCs
ALTER TABLE sunat_resumenes_diarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rc_select" ON sunat_resumenes_diarios;
DROP POLICY IF EXISTS "rc_insert" ON sunat_resumenes_diarios;
DROP POLICY IF EXISTS "rc_update" ON sunat_resumenes_diarios;

CREATE POLICY "rc_select" ON sunat_resumenes_diarios
  FOR SELECT USING (ferreteria_id = mi_ferreteria_id());

CREATE POLICY "rc_insert" ON sunat_resumenes_diarios
  FOR INSERT WITH CHECK (ferreteria_id = mi_ferreteria_id());

CREATE POLICY "rc_update" ON sunat_resumenes_diarios
  FOR UPDATE USING (ferreteria_id = mi_ferreteria_id());

CREATE INDEX IF NOT EXISTS idx_sunat_rc_ferreteria_fecha
  ON sunat_resumenes_diarios (ferreteria_id, fecha DESC);
