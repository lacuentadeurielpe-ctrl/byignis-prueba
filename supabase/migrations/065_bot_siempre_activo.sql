-- Permite al dueño activar el bot 24/7 ignorando horario de atención
ALTER TABLE public.ferreterias
  ADD COLUMN IF NOT EXISTS bot_siempre_activo BOOLEAN NOT NULL DEFAULT false;
