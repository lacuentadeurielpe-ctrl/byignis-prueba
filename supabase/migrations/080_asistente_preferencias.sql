-- MIGRACIÓN 080 — Preferencias y auditoría del Asistente IA nativo
-- Agrega columna JSONB en configuracion_bot para:
--   memorias: preferencias del dueño persistidas entre sesiones (max 10, 200 chars c/u)
--   auditoria: log de las últimas 50 acciones del asistente (tool calls)

ALTER TABLE public.configuracion_bot
  ADD COLUMN IF NOT EXISTS asistente_preferencias JSONB NOT NULL
  DEFAULT '{"memorias":[],"auditoria":[]}';
