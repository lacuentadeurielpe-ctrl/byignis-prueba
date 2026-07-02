-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN 097 — Series y correlativos SUNAT con reserva atómica
-- Antes: serie única por tipo en ferreterias + correlativo = MAX(numero)+1,
-- que puede desincronizarse con SUNAT ante fallos. Ahora: tabla dedicada con
-- reserva atómica (bloqueo de fila) y rollback si SUNAT rechaza.
-- Soporta múltiples series por negocio (sucursal / terminal).
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sunat_series (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id      UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,

  -- Tipo de documento SUNAT (catálogo 01): 01=Factura, 03=Boleta, 07=NC, 08=ND
  tipo_doc           TEXT NOT NULL CHECK (tipo_doc IN ('01','03','07','08')),
  serie              TEXT NOT NULL,              -- ej: F001, B001, FC01, BC01

  -- Último correlativo YA usado (0 = ninguno emitido aún)
  correlativo_actual INTEGER NOT NULL DEFAULT 0,

  sucursal           TEXT,                       -- opcional, multi-sucursal/terminal
  descripcion        TEXT,
  activo             BOOLEAN NOT NULL DEFAULT true,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS sunat_series_unique
  ON sunat_series (ferreteria_id, tipo_doc, serie);

ALTER TABLE sunat_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sunat_series_select" ON sunat_series;
DROP POLICY IF EXISTS "sunat_series_insert" ON sunat_series;
DROP POLICY IF EXISTS "sunat_series_update" ON sunat_series;
DROP POLICY IF EXISTS "sunat_series_delete" ON sunat_series;

CREATE POLICY "sunat_series_select" ON sunat_series
  FOR SELECT USING (ferreteria_id = mi_ferreteria_id());
CREATE POLICY "sunat_series_insert" ON sunat_series
  FOR INSERT WITH CHECK (ferreteria_id = mi_ferreteria_id());
CREATE POLICY "sunat_series_update" ON sunat_series
  FOR UPDATE USING (ferreteria_id = mi_ferreteria_id());
CREATE POLICY "sunat_series_delete" ON sunat_series
  FOR DELETE USING (ferreteria_id = mi_ferreteria_id());

-- ── Reserva atómica: devuelve el siguiente correlativo e incrementa ────────────
-- El UPDATE ... RETURNING toma un lock de fila → reservas concurrentes se serializan.
CREATE OR REPLACE FUNCTION reservar_correlativo_serie(
  p_ferreteria_id UUID,
  p_tipo_doc      TEXT,
  p_serie         TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  INSERT INTO sunat_series (ferreteria_id, tipo_doc, serie, correlativo_actual)
  VALUES (p_ferreteria_id, p_tipo_doc, p_serie, 0)
  ON CONFLICT (ferreteria_id, tipo_doc, serie) DO NOTHING;

  UPDATE sunat_series
     SET correlativo_actual = correlativo_actual + 1,
         updated_at = NOW()
   WHERE ferreteria_id = p_ferreteria_id
     AND tipo_doc = p_tipo_doc
     AND serie = p_serie
  RETURNING correlativo_actual INTO v_next;

  RETURN v_next;
END;
$$;

-- ── Rollback: revierte SOLO si el correlativo sigue siendo la punta ─────────────
-- Si otro documento ya reservó después, se deja el hueco (legal en SUNAT: un doc
-- rechazado no consume correlativo, los huecos de numeración son válidos).
CREATE OR REPLACE FUNCTION rollback_correlativo_serie(
  p_ferreteria_id UUID,
  p_tipo_doc      TEXT,
  p_serie         TEXT,
  p_correlativo   INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  UPDATE sunat_series
     SET correlativo_actual = correlativo_actual - 1,
         updated_at = NOW()
   WHERE ferreteria_id = p_ferreteria_id
     AND tipo_doc = p_tipo_doc
     AND serie = p_serie
     AND correlativo_actual = p_correlativo
  RETURNING true INTO v_ok;

  RETURN COALESCE(v_ok, false);
END;
$$;

-- ── Backfill: sembrar series desde la config actual + MAX(numero) emitido ───────
-- Boletas (03)
INSERT INTO sunat_series (ferreteria_id, tipo_doc, serie, correlativo_actual)
SELECT f.id, '03', COALESCE(f.serie_boletas, 'B001'),
       COALESCE((SELECT MAX(c.numero) FROM comprobantes c
                  WHERE c.ferreteria_id = f.id AND c.tipo = 'boleta'
                    AND c.serie = COALESCE(f.serie_boletas, 'B001')), 0)
FROM ferreterias f
ON CONFLICT (ferreteria_id, tipo_doc, serie) DO NOTHING;

-- Facturas (01)
INSERT INTO sunat_series (ferreteria_id, tipo_doc, serie, correlativo_actual)
SELECT f.id, '01', COALESCE(f.serie_facturas, 'F001'),
       COALESCE((SELECT MAX(c.numero) FROM comprobantes c
                  WHERE c.ferreteria_id = f.id AND c.tipo = 'factura'
                    AND c.serie = COALESCE(f.serie_facturas, 'F001')), 0)
FROM ferreterias f
ON CONFLICT (ferreteria_id, tipo_doc, serie) DO NOTHING;

-- Notas de crédito (07) — sembrar desde las series ya usadas en comprobantes
INSERT INTO sunat_series (ferreteria_id, tipo_doc, serie, correlativo_actual)
SELECT c.ferreteria_id, '07', c.serie, MAX(c.numero)
FROM comprobantes c
WHERE c.tipo = 'nota_credito' AND c.serie IS NOT NULL
GROUP BY c.ferreteria_id, c.serie
ON CONFLICT (ferreteria_id, tipo_doc, serie) DO NOTHING;
