-- FASE 0: Motor de herramientas por agente
-- Almacena las tools explícitamente desactivadas por el tenant (semántica opt-out).
-- Ausente / vacío = todo activo → sin impacto en tenants existentes.

ALTER TABLE ferreterias
  ADD COLUMN IF NOT EXISTS bot_herramientas_desactivadas text[] NOT NULL DEFAULT '{}';
