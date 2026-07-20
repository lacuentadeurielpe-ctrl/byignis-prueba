-- ═══════════════════════════════════════════════════════════════════════════
-- 117: Suscripciones SaaS con Mercado Pago
--
-- 1. Plan único "Todo Incluido" (S/ 85/mes) — el plan real de venta.
-- 2. Columnas MP en suscripciones (preapproval id + email del pagador).
-- 3. Tabla pagos_saas: historial de cobros mensuales (audit para superadmin).
-- 4. Trigger: al crear una ferretería se crea su suscripción trial de 3 días.
-- 5. RLS: los miembros (vendedores) también pueden leer la suscripción de su
--    ferretería — antes solo el dueño, lo que bloqueaba a los empleados.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Plan único de venta ──────────────────────────────────────────────────
INSERT INTO planes (nombre, creditos_mes, precio_mensual, precio_exceso, activo)
SELECT 'Todo Incluido', 999999, 85.00, 0, TRUE
WHERE NOT EXISTS (SELECT 1 FROM planes WHERE nombre = 'Todo Incluido');

-- ── 2. Columnas Mercado Pago ────────────────────────────────────────────────
ALTER TABLE suscripciones ADD COLUMN IF NOT EXISTS mp_preapproval_id TEXT;
ALTER TABLE suscripciones ADD COLUMN IF NOT EXISTS mp_payer_email    TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_suscripciones_mp_preapproval
  ON suscripciones (mp_preapproval_id)
  WHERE mp_preapproval_id IS NOT NULL;

-- ── 3. Historial de cobros SaaS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pagos_saas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id     UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  mp_payment_id     TEXT,
  mp_preapproval_id TEXT,
  monto             NUMERIC(10,2),
  moneda            TEXT DEFAULT 'PEN',
  estado            TEXT,          -- approved | rejected | pending | refunded...
  fecha             TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw               JSONB
);

CREATE INDEX IF NOT EXISTS idx_pagos_saas_ferreteria ON pagos_saas (ferreteria_id);
-- Único simple (no parcial) para que sirva de árbitro en upserts ON CONFLICT.
-- Postgres permite múltiples NULL en índices únicos.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pagos_saas_mp_payment
  ON pagos_saas (mp_payment_id);

-- Solo el service role (webhook / superadmin) escribe y lee: RLS sin políticas.
ALTER TABLE pagos_saas ENABLE ROW LEVEL SECURITY;

-- ── 4. Trial automático de 3 días al registrarse ────────────────────────────
CREATE OR REPLACE FUNCTION crear_suscripcion_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  SELECT id INTO v_plan_id FROM planes WHERE nombre = 'Todo Incluido' LIMIT 1;
  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM planes WHERE activo = TRUE ORDER BY created_at LIMIT 1;
  END IF;

  INSERT INTO suscripciones (
    ferreteria_id, plan_id, estado,
    ciclo_inicio, ciclo_fin,
    creditos_del_mes, creditos_disponibles
  )
  VALUES (
    NEW.id, v_plan_id, 'trial',
    CURRENT_DATE, CURRENT_DATE + 3,
    999999, 999999
  )
  ON CONFLICT (ferreteria_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_crear_suscripcion_trial ON ferreterias;
CREATE TRIGGER trigger_crear_suscripcion_trial
  AFTER INSERT ON ferreterias
  FOR EACH ROW EXECUTE FUNCTION crear_suscripcion_trial();

-- ── 5. RLS: miembros también leen la suscripción de su ferretería ───────────
DROP POLICY IF EXISTS suscripciones_miembros ON suscripciones;
CREATE POLICY suscripciones_miembros ON suscripciones
  FOR SELECT TO authenticated
  USING (ferreteria_id = mi_ferreteria_id());
