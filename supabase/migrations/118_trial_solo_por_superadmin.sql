-- ═══════════════════════════════════════════════════════════════════════════
-- 118: La prueba gratuita deja de ser automática — solo la otorga el superadmin
--
-- Antes: toda ferretería nueva nacía con 3 días de trial (migración 117).
-- Ahora: nace SUSPENDIDA → el dueño completa onboarding y cae al paywall de
-- S/80. La prueba de 3 días es una cortesía que el superadmin activa, renueva
-- o desactiva manualmente desde el panel.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Auditoría del trial (quién lo dio y cuántas veces se renovó) ─────────
ALTER TABLE suscripciones ADD COLUMN IF NOT EXISTS trial_otorgado_por  TEXT;
ALTER TABLE suscripciones ADD COLUMN IF NOT EXISTS trial_otorgado_at   TIMESTAMPTZ;
ALTER TABLE suscripciones ADD COLUMN IF NOT EXISTS trial_renovaciones  INT NOT NULL DEFAULT 0;

-- ── 2. Las cuentas nuevas nacen suspendidas (sin trial automático) ──────────
-- Se mantiene la creación de la fila para que el tenant siempre tenga su
-- registro de suscripción con plan asignado; solo cambia el estado inicial.
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
    NEW.id, v_plan_id, 'suspendido',
    NULL, NULL,
    999999, 999999
  )
  ON CONFLICT (ferreteria_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── 3. Normalizar trials "eternos" heredados del bug del panel ─────────────
-- El PATCH del superadmin ponía estado='trial' sin tocar ciclo_fin, dejando
-- fechas como 2099-12-31 (prueba de 73 años). Los que tengan ciclo_fin muy
-- lejano pasan a 'activo', que es lo que realmente se quiso otorgar.
UPDATE suscripciones
SET estado = 'activo'
WHERE estado = 'trial'
  AND ciclo_fin IS NOT NULL
  AND ciclo_fin > CURRENT_DATE + 365;
