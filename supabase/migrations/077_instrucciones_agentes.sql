-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN 077 — instrucciones_agentes en configuracion_bot
--
-- Añade una nueva capa de personalización entre las instrucciones
-- globales (perfil_bot.instrucciones_extra) y las secciones del
-- prompt (prompt_overrides):
--
--   instrucciones_extra (global, siempre)
--     └─ instrucciones_agentes[id] (por agente, solo si ese agente está ON)
--          └─ instrucciones_tools[name]  (Fase 2 — aún no implementado)
--
-- El orquestador inyecta la instrucción de un agente justo después
-- del bloque de reglas de ese agente, solo cuando está activo.
-- Campo vacío o ausente = comportamiento idéntico al actual.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.configuracion_bot
  ADD COLUMN IF NOT EXISTS instrucciones_agentes JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.configuracion_bot.instrucciones_agentes IS
  'Instrucciones específicas por agente. Formato: { "ventas": "texto...", "pagos": "texto..." }.
   Se inyectan en el prompt del orquestador SOLO cuando ese agente está activo (bot_agentes_activos).
   Campo vacío o ausente = sin instrucción especial = comportamiento predeterminado.
   Relacionado con Fase 2 (instrucciones_tools) y Fase 4 (asistente IA).';
