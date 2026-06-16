-- Unifica y conecta la configuración del bot (Settings → Bot).
-- 1. Elimina bot_grace_period_min: setting huérfano, ninguna parte del código lo leía.
-- 2. Agrega bot_delay_respuesta_ms: demora artificial antes de enviar la respuesta del bot
--    (simula tiempo de escritura humano, separado del debounce que agrupa mensajes del cliente).
-- 3. Agrega configuracion_bot.prompt_overrides: texto editable por sección del system prompt
--    del orquestador v2, con botón de "restablecer a predeterminado" por sección.

ALTER TABLE ferreterias DROP COLUMN IF EXISTS bot_grace_period_min;

ALTER TABLE ferreterias
  ADD COLUMN IF NOT EXISTS bot_delay_respuesta_ms INTEGER NOT NULL DEFAULT 0;

ALTER TABLE configuracion_bot
  ADD COLUMN IF NOT EXISTS prompt_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;
