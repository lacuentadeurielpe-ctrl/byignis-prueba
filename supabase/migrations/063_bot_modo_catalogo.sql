-- Modo de catálogo que usa el bot de WhatsApp para buscar productos
-- 'fisicos'  → solo productos físicos (default, comportamiento actual)
-- 'digitales' → solo productos digitales
-- 'ambos'    → busca primero en físicos, luego en digitales

ALTER TABLE public.ferreterias
  ADD COLUMN IF NOT EXISTS bot_modo_catalogo TEXT NOT NULL DEFAULT 'fisicos'
    CHECK (bot_modo_catalogo IN ('fisicos', 'digitales', 'ambos'));
