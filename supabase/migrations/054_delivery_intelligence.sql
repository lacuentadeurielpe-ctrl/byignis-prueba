-- =============================================
-- Migration 054: Delivery Intelligence Module
-- Predictions, Events, Zone Stats + extensions
-- =============================================

-- A) delivery_predictions — stores ETA predictions with input features + actual outcomes
CREATE TABLE IF NOT EXISTS delivery_predictions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id     UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  entrega_id        UUID NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  pedido_id         UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,

  -- Input features (snapshot at prediction time)
  zona_delivery_id  UUID REFERENCES zonas_delivery(id),
  vehiculo_tipo     TEXT,
  distancia_km      NUMERIC(8,2),
  peso_total_kg     NUMERIC(8,2),
  items_count       INTEGER,
  cola_depth        INTEGER,
  hora_dia          INTEGER CHECK (hora_dia BETWEEN 0 AND 23),
  dia_semana        INTEGER CHECK (dia_semana BETWEEN 0 AND 6),

  -- Prediction output
  eta_predicho_min  INTEGER NOT NULL,
  eta_source        TEXT NOT NULL DEFAULT 'haversine',
  confidence        NUMERIC(3,2) DEFAULT 0.00,
  model_version     TEXT DEFAULT 'v1',

  -- Actual outcome (backfilled when entrega completes)
  duracion_real_min INTEGER,
  error_min         INTEGER,

  -- Owner feedback (for training refinement)
  owner_feedback    JSONB,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- B) delivery_events — event log for notifications + analytics
CREATE TABLE IF NOT EXISTS delivery_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id     UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  entrega_id        UUID NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,

  evento            TEXT NOT NULL,
  detalle           JSONB,
  canales_enviados  TEXT[] DEFAULT '{}',
  notificado_at     TIMESTAMPTZ,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- C) delivery_zone_stats — pre-aggregated stats per zone + hour + day
CREATE TABLE IF NOT EXISTS delivery_zone_stats (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id     UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  zona_delivery_id  UUID NOT NULL REFERENCES zonas_delivery(id) ON DELETE CASCADE,

  hora_bloque       INTEGER NOT NULL CHECK (hora_bloque BETWEEN 0 AND 23),
  dia_semana        INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),

  entregas_count    INTEGER DEFAULT 0,
  avg_duracion_min  NUMERIC(8,2),
  median_duracion_min NUMERIC(8,2),
  p90_duracion_min  NUMERIC(8,2),
  avg_error_min     NUMERIC(8,2),

  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(ferreteria_id, zona_delivery_id, hora_bloque, dia_semana)
);

-- =============================================
-- Indexes
-- =============================================

CREATE INDEX IF NOT EXISTS idx_predictions_entrega ON delivery_predictions(entrega_id);
CREATE INDEX IF NOT EXISTS idx_predictions_ferreteria_fecha ON delivery_predictions(ferreteria_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_outcome ON delivery_predictions(ferreteria_id, duracion_real_min) WHERE duracion_real_min IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_entrega ON delivery_events(entrega_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_ferreteria ON delivery_events(ferreteria_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_evento ON delivery_events(ferreteria_id, evento);

CREATE INDEX IF NOT EXISTS idx_zone_stats_lookup ON delivery_zone_stats(ferreteria_id, zona_delivery_id, dia_semana, hora_bloque);

-- =============================================
-- RLS Policies
-- =============================================

ALTER TABLE delivery_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "predictions_select" ON delivery_predictions FOR SELECT USING (ferreteria_id = mi_ferreteria_id());
CREATE POLICY "predictions_insert" ON delivery_predictions FOR INSERT WITH CHECK (ferreteria_id = mi_ferreteria_id());
CREATE POLICY "predictions_update" ON delivery_predictions FOR UPDATE USING (ferreteria_id = mi_ferreteria_id());

ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select" ON delivery_events FOR SELECT USING (ferreteria_id = mi_ferreteria_id());
CREATE POLICY "events_insert" ON delivery_events FOR INSERT WITH CHECK (ferreteria_id = mi_ferreteria_id());

ALTER TABLE delivery_zone_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zone_stats_select" ON delivery_zone_stats FOR SELECT USING (ferreteria_id = mi_ferreteria_id());
CREATE POLICY "zone_stats_insert" ON delivery_zone_stats FOR INSERT WITH CHECK (ferreteria_id = mi_ferreteria_id());
CREATE POLICY "zone_stats_update" ON delivery_zone_stats FOR UPDATE USING (ferreteria_id = mi_ferreteria_id());

-- =============================================
-- Extensions to existing tables
-- =============================================

-- Weight per item for better ETA predictions
ALTER TABLE items_pedido ADD COLUMN IF NOT EXISTS peso_kg NUMERIC(8,2);

-- Per-tenant AI delivery configuration
ALTER TABLE ferreterias ADD COLUMN IF NOT EXISTS delivery_ai_config JSONB DEFAULT '{"delay_threshold_min": 15, "confidence_min_entregas": 5, "stats_window_days": 90}';

-- Comments
COMMENT ON TABLE delivery_predictions IS 'ETA predictions with input features and actual outcomes for ML training';
COMMENT ON TABLE delivery_events IS 'Event log for delivery notifications and analytics';
COMMENT ON TABLE delivery_zone_stats IS 'Pre-aggregated delivery stats per zone/hour/day for fast ETA lookup';
COMMENT ON COLUMN delivery_predictions.eta_source IS 'Source: google | zone_avg | haversine';
COMMENT ON COLUMN delivery_predictions.error_min IS 'predicho - real: positive = overestimate, negative = underestimate';
COMMENT ON COLUMN delivery_events.canales_enviados IS 'Array of channels notified: whatsapp, telegram, email, etc.';
