-- Fase 3: crédito formal + recordatorios de deuda automáticos

-- 1. Columna de configuración de recordatorios en configuracion_bot
ALTER TABLE public.configuracion_bot
  ADD COLUMN IF NOT EXISTS config_recordatorios_deuda JSONB NOT NULL DEFAULT '{"activo": false, "dias_gracia": 1, "mensaje_custom": ""}';

COMMENT ON COLUMN public.configuracion_bot.config_recordatorios_deuda IS
  'Config de recordatorios automáticos de crédito vencido enviados por WhatsApp.
   activo: habilita el cron; dias_gracia: días después de fecha_limite para empezar a recordar;
   mensaje_custom: texto adicional al final del mensaje (vacío = default genérico).';

-- 2. Columna en creditos para evitar spam: solo se envía 1 recordatorio por día por crédito
ALTER TABLE public.creditos
  ADD COLUMN IF NOT EXISTS ultimo_recordatorio_enviado_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.creditos.ultimo_recordatorio_enviado_at IS
  'Última vez que el cron recordatorios-deuda envió un aviso por este crédito.
   El cron solo reenvía si este valor es NULL o anterior al día actual (Lima).';

-- Índice para el cron: creditos activos/vencidos con cliente asignado
CREATE INDEX IF NOT EXISTS idx_creditos_recordatorio
  ON public.creditos (ferreteria_id, estado, fecha_limite)
  WHERE cliente_id IS NOT NULL AND estado IN ('activo', 'vencido');
