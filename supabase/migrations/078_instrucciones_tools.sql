-- Fase 2: instrucciones por herramienta (notas de comportamiento específicas por tool)
ALTER TABLE public.configuracion_bot
  ADD COLUMN IF NOT EXISTS instrucciones_tools JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.configuracion_bot.instrucciones_tools IS
  'Notas de uso por tool: { "crear_pedido": "Para pedidos > S/1000 confirmar con encargado", ... }
   Se inyectan en el prompt del orquestador como sección "Notas de comportamiento por herramienta".
   Sólo se muestran notas de tools activas (no desactivadas ni de agentes apagados).';
