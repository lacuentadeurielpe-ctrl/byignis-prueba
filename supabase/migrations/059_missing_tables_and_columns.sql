-- Migration 059: Columnas faltantes en ferreterias para settings-2
--
-- NOTA: creditos, rendiciones, invitaciones, acciones_auditadas ya existían en producción.
-- vehiculos ya existe con schema completo (velocidad_promedio_kmh, capacidad_kg).
-- Solo se agregan las columnas bot_ y modulos_activos a ferreterias.

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- COLUMNAS EN ferreterias (settings-2 bot + avanzado)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE public.ferreterias
  ADD COLUMN IF NOT EXISTS bot_nombre               TEXT,
  ADD COLUMN IF NOT EXISTS bot_instrucciones        TEXT,
  ADD COLUMN IF NOT EXISTS bot_personalidad         TEXT    DEFAULT 'amigable_peruano',
  ADD COLUMN IF NOT EXISTS bot_margen_minimo        NUMERIC(5,2) DEFAULT 5,
  ADD COLUMN IF NOT EXISTS bot_debounce_ms          INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS bot_grace_period_min     INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS bot_autoclose_cotizacion BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bot_agentes_activos      TEXT[]  DEFAULT ARRAY['ventas','comprobantes','upsell','crm']::TEXT[],
  ADD COLUMN IF NOT EXISTS modulos_activos          TEXT[]  DEFAULT ARRAY['crm','delivery','creditos','pos','analytics']::TEXT[];
