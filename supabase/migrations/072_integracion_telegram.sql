-- Credenciales de Telegram para el bot de cada ferretería.
-- El token del bot de Telegram permite que el bot notifique un canal/grupo de la tienda.
ALTER TABLE ferreterias
  ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT,
  ADD COLUMN IF NOT EXISTS telegram_chat_id   TEXT;
