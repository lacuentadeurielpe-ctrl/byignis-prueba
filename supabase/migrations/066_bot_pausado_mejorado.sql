-- Migration 066: Bot pausado mejorado + tracking de mensajes YCloud
-- Agrega soporte para: motivo de pausa, auto-resume con timer, estado de lectura

-- ── 1. Columnas en conversaciones ────────────────────────────────────────────
ALTER TABLE conversaciones
  ADD COLUMN IF NOT EXISTS bot_pausado_hasta   TIMESTAMPTZ,     -- NULL = manual (no expira)
  ADD COLUMN IF NOT EXISTS bot_pausado_motivo  TEXT,            -- 'owner_dashboard' | 'owner_ycloud' | 'ia_escalation' | 'cliente_pidio'
  ADD COLUMN IF NOT EXISTS pausado_at          TIMESTAMPTZ;     -- cuándo se pausó

-- ── 2. Tracking de estado en mensajes salientes ───────────────────────────────
-- Para saber si el cliente leyó el mensaje (✓ enviado, ✓✓ entregado, 🔵 leído)
ALTER TABLE mensajes
  ADD COLUMN IF NOT EXISTS ycloud_status       TEXT,            -- 'sent' | 'delivered' | 'read' | 'failed'
  ADD COLUMN IF NOT EXISTS ycloud_status_at    TIMESTAMPTZ;     -- cuándo cambió el estado

-- ── 3. Índice para auto-resume eficiente ─────────────────────────────────────
-- Permite encontrar rápidamente convos pausadas con timer expirado
CREATE INDEX IF NOT EXISTS idx_conversaciones_bot_pausado_hasta
  ON conversaciones (ferreteria_id, bot_pausado_hasta)
  WHERE bot_pausado = true AND bot_pausado_hasta IS NOT NULL;

-- ── 4. Índice para tracking de estado de mensajes ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mensajes_ycloud_status
  ON mensajes (ycloud_message_id)
  WHERE ycloud_message_id IS NOT NULL;
