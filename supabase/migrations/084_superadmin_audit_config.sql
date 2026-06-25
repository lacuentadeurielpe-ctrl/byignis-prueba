-- 084_superadmin_audit_config.sql
-- Tabla de auditoría de acciones del superadmin + configuración global de la plataforma

-- ── 1. Log de auditoría del superadmin ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS superadmin_audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  superadmin_id UUID        REFERENCES superadmins(id) ON DELETE SET NULL,
  accion        TEXT        NOT NULL,
  recurso_tipo  TEXT,                             -- 'tenant', 'plan', 'tarifa_ia', 'config', etc.
  recurso_id    TEXT,                             -- UUID o clave del recurso afectado
  metadata      JSONB       DEFAULT '{}',         -- datos adicionales (valores antes/después)
  ip            TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_superadmin ON superadmin_audit_log (superadmin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created    ON superadmin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_recurso    ON superadmin_audit_log (recurso_tipo, recurso_id);

-- ── 2. Configuración global de la plataforma ────────────────────────────────
CREATE TABLE IF NOT EXISTS config_plataforma (
  clave          TEXT        PRIMARY KEY,
  valor          JSONB       NOT NULL,
  descripcion    TEXT,
  actualizado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_por UUID       REFERENCES superadmins(id) ON DELETE SET NULL
);

-- ── 3. Seed: valores actuales sacados de los hardcodes del código ───────────
INSERT INTO config_plataforma (clave, valor, descripcion) VALUES
  ('tipo_cambio_usd_pen',         '3.75',                       'Tipo de cambio S/↔USD usado en toda la plataforma'),
  ('creditos_respuesta',          '1',                          'Créditos por respuesta simple del bot (DeepSeek)'),
  ('creditos_crm_faq',            '1',                          'Créditos por consulta CRM, FAQ o estado de pedido'),
  ('creditos_cotizacion',         '3',                          'Créditos por cotización generada (DeepSeek)'),
  ('creditos_pedido',             '3',                          'Créditos por pedido confirmado (DeepSeek)'),
  ('creditos_audio',              '2',                          'Créditos por transcripción de audio (Whisper)'),
  ('creditos_imagen',             '4',                          'Créditos por análisis de imagen (GPT-4o Vision)'),
  ('creditos_inventario',         '2',                          'Créditos por análisis de inventario (DeepSeek)'),
  ('creditos_reporte_ia',         '5',                          'Créditos por reporte generado con IA'),
  ('creditos_orquestador',        '8',                          'Créditos por situación compleja con orquestador Claude'),
  ('creditos_bienvenida',         '50',                         'Créditos que recibe un tenant nuevo al registrarse'),
  ('modelo_default_bot',          '"deepseek-chat"',            'Modelo IA para respuestas del bot (tareas simples)'),
  ('modelo_default_orquestador',  '"claude-sonnet-4-6"',        'Modelo IA para el orquestador (casos complejos)'),
  ('modelo_default_audio',        '"whisper-1"',                'Modelo para transcripción de audio'),
  ('modelo_default_vision',       '"gpt-4o"',                   'Modelo para análisis de imágenes'),
  ('modo_mantenimiento',          'false',                      'Si true, pausa todos los bots y muestra mensaje de mantenimiento'),
  ('mensaje_mantenimiento',       '"Estamos realizando mantenimiento. El asistente estará disponible en breve."', 'Mensaje cuando el bot está en mantenimiento'),
  ('mensaje_creditos_agotados',   '"Tu ferretería ha alcanzado el límite de consultas del mes. Contacta a tu administrador para recargar créditos."', 'Mensaje cuando el tenant no tiene créditos')
ON CONFLICT (clave) DO NOTHING;

-- ── 4. Columna actualizado_por en tarifas_ia ────────────────────────────────
ALTER TABLE tarifas_ia
  ADD COLUMN IF NOT EXISTS actualizado_por UUID REFERENCES superadmins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actualizado_at  TIMESTAMPTZ DEFAULT NOW();
