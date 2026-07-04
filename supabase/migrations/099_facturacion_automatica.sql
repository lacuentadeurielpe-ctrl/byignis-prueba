-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN 099 — Facturación automática (cola de reintentos + anulaciones)
--
-- Reemplaza el flujo manual "agrupar boletas del día y declarar" (ya redundante:
-- desde 2023 SUNAT exige informar cada boleta individualmente, lo que el sistema
-- ya hace en cada venta) por dos mecanismos automáticos:
--
--   1. Cola de reintentos: un envío que falla por causa de infraestructura
--      (Lycet/SUNAT caído, timeout) NO debe perder la venta. Se reintenta solo.
--   2. Anulaciones: el único uso legítimo restante del Resumen Diario (RC) es
--      dar de baja boletas ya aceptadas (detalle con estado '3'). Las facturas
--      se anulan con Comunicación de Baja (RA / Voided), un documento distinto.
-- ══════════════════════════════════════════════════════════════════

-- ── Cola de reintentos ────────────────────────────────────────────────────────
ALTER TABLE comprobantes
  ADD COLUMN IF NOT EXISTS intentos_envio      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proximo_intento_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultimo_error_sunat  TEXT,
  ADD COLUMN IF NOT EXISTS requiere_atencion   BOOLEAN NOT NULL DEFAULT false;

-- ── Anulación (solicitud del dueño; el envío real a SUNAT lo hace el job nocturno) ──
ALTER TABLE comprobantes
  ADD COLUMN IF NOT EXISTS anulacion_solicitada    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS anulacion_motivo         TEXT,
  ADD COLUMN IF NOT EXISTS anulacion_solicitada_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anulacion_solicitada_por TEXT,
  ADD COLUMN IF NOT EXISTS comunicacion_baja_id     UUID;

-- estado_sunat: agregar 'error_reintentable' (infra, en cola) y 'baja_pendiente'
-- (anulación enviada a SUNAT, esperando CDR del RC/RA)
ALTER TABLE comprobantes DROP CONSTRAINT IF EXISTS comprobantes_estado_sunat_check;
ALTER TABLE comprobantes ADD CONSTRAINT comprobantes_estado_sunat_check
  CHECK (estado_sunat IS NULL OR estado_sunat IN
    ('borrador','enviado','aceptado','aceptado_obs','rechazado',
     'anulado','baja','error_reintentable','baja_pendiente'));

CREATE INDEX IF NOT EXISTS idx_comprobantes_reintento
  ON comprobantes (proximo_intento_at)
  WHERE estado_sunat = 'error_reintentable' AND requiere_atencion = false;

CREATE INDEX IF NOT EXISTS idx_comprobantes_anulacion_pendiente
  ON comprobantes (ferreteria_id, tipo)
  WHERE anulacion_solicitada = true AND estado_sunat NOT IN ('anulado', 'baja');

-- ── Comunicación de Baja (RA) — anulación de facturas/notas ────────────────────
-- Análoga a sunat_resumenes_diarios (que ahora se usa solo para bajas de boletas),
-- pero usa el endpoint/documento Voided de Greenter (distinto de Summary).
CREATE TABLE IF NOT EXISTS sunat_comunicaciones_baja (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id      UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,

  fecha              DATE NOT NULL,       -- fecha de comunicación (envío)
  correlativo        INTEGER NOT NULL DEFAULT 1,
  ticket             TEXT,

  estado             TEXT NOT NULL DEFAULT 'enviado'
                       CHECK (estado IN ('enviado', 'aceptado', 'rechazado', 'error')),
  cdr_codigo         TEXT,
  cdr_descripcion    TEXT,

  comprobantes_count INTEGER NOT NULL DEFAULT 0,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consultado_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS sunat_baja_ferreteria_fecha_corr
  ON sunat_comunicaciones_baja (ferreteria_id, fecha, correlativo);

ALTER TABLE sunat_comunicaciones_baja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "baja_select" ON sunat_comunicaciones_baja;
DROP POLICY IF EXISTS "baja_insert" ON sunat_comunicaciones_baja;
DROP POLICY IF EXISTS "baja_update" ON sunat_comunicaciones_baja;

CREATE POLICY "baja_select" ON sunat_comunicaciones_baja
  FOR SELECT USING (ferreteria_id = mi_ferreteria_id());
CREATE POLICY "baja_insert" ON sunat_comunicaciones_baja
  FOR INSERT WITH CHECK (ferreteria_id = mi_ferreteria_id());
CREATE POLICY "baja_update" ON sunat_comunicaciones_baja
  FOR UPDATE USING (ferreteria_id = mi_ferreteria_id());

CREATE INDEX IF NOT EXISTS idx_sunat_baja_ferreteria
  ON sunat_comunicaciones_baja (ferreteria_id, fecha DESC);

ALTER TABLE comprobantes
  ADD CONSTRAINT comprobantes_comunicacion_baja_fk
    FOREIGN KEY (comunicacion_baja_id) REFERENCES sunat_comunicaciones_baja(id);

-- sunat_resumenes_diarios: a partir de ahora se usa exclusivamente para bajas de
-- boletas (no para "declarar" — eso ya lo hace la emisión individual). Se marca
-- con `tipo` para dejar explícito el propósito de cada fila histórica/nueva.
ALTER TABLE sunat_resumenes_diarios
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'baja'
    CHECK (tipo IN ('declaracion', 'baja'));
-- Filas existentes (creadas por el flujo manual anterior) eran declaraciones.
UPDATE sunat_resumenes_diarios SET tipo = 'declaracion' WHERE tipo = 'baja';
