-- 081_ia_tarifas_facturacion.sql
-- Sistema de gestión económica IA: tarifas proveedor, precios a tenants, facturas de gasto

-- ── 1. Tarifas de proveedores IA (lo que pagamos a Anthropic, DeepSeek, OpenAI, Google)
CREATE TABLE IF NOT EXISTS tarifas_ia (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo                TEXT        NOT NULL,
  proveedor             TEXT        NOT NULL,
  unidad                TEXT        NOT NULL DEFAULT 'tokens'
                          CHECK (unidad IN ('tokens', 'minutos', 'imagenes')),
  precio_entrada_por_1k NUMERIC(12,8) NOT NULL DEFAULT 0,
  precio_salida_por_1k  NUMERIC(12,8) NOT NULL DEFAULT 0,
  activo                BOOLEAN     NOT NULL DEFAULT TRUE,
  notas                 TEXT,
  actualizado_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (modelo)
);

-- Seed con los precios actuales (hardcodeados en credits.ts → pasan a ser editables desde la BD)
INSERT INTO tarifas_ia (modelo, proveedor, unidad, precio_entrada_por_1k, precio_salida_por_1k, notas)
VALUES
  ('deepseek-chat',              'DeepSeek',  'tokens',  0.00014000, 0.00028000, 'DeepSeek V3 — modelo principal del bot'),
  ('gpt-4o-mini',                'OpenAI',    'tokens',  0.00015000, 0.00060000, 'GPT-4o mini (fallback legacy)'),
  ('claude-3-5-sonnet-20241022', 'Anthropic', 'tokens',  0.00300000, 0.01500000, 'Claude 3.5 Sonnet (modelo anterior)'),
  ('claude-sonnet-4-6',          'Anthropic', 'tokens',  0.00300000, 0.01500000, 'Claude Sonnet 4.6 — orquestador + asistente IA'),
  ('gpt-4o',                     'OpenAI',    'tokens',  0.00500000, 0.01500000, 'GPT-4o (no usado actualmente)'),
  ('gemini-2.5-flash',           'Google',    'tokens',  0.00015000, 0.00060000, 'Gemini 2.5 Flash — análisis de imágenes/documentos'),
  ('whisper-1',                  'OpenAI',    'minutos', 0.00600000, 0.00000000,
     'Whisper ASR — precio por minuto de audio. tokens_entrada = segundos de audio / 60')
ON CONFLICT (modelo) DO NOTHING;

-- ── 2. Paquetes / tarifas que cobramos a tenants
CREATE TABLE IF NOT EXISTS tarifas_creditos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT        NOT NULL,
  tipo         TEXT        NOT NULL DEFAULT 'por_lote'
                 CHECK (tipo IN ('por_lote', 'por_credito', 'mensual')),
  creditos     INTEGER     NOT NULL DEFAULT 0,
  precio_usd   NUMERIC(10,4) NOT NULL DEFAULT 0,
  precio_pen   NUMERIC(10,2),
  es_default   BOOLEAN     NOT NULL DEFAULT FALSE,
  activo       BOOLEAN     NOT NULL DEFAULT TRUE,
  descripcion  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Solo puede haber un plan default activo (restricción parcial via trigger)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tarifas_creditos_default
  ON tarifas_creditos (es_default) WHERE es_default = TRUE AND activo = TRUE;

-- Paquetes iniciales
INSERT INTO tarifas_creditos (nombre, tipo, creditos, precio_usd, precio_pen, es_default, descripcion)
VALUES
  ('Plan Mensual Base',   'mensual',     1000,  5.00, 18.50, TRUE,
     '1,000 créditos IA mensuales — incluye DeepSeek + llamadas cortas al orquestador'),
  ('Pack 500 créditos',   'por_lote',     500,  2.50,  9.25, FALSE,
     'Recarga puntual de 500 créditos'),
  ('Pack 2,000 créditos', 'por_lote',    2000,  8.00, 29.60, FALSE,
     'Recarga de 2,000 créditos — equivale a ahorro del 20% vs precio unitario'),
  ('Crédito individual',  'por_credito',    1,  0.005, 0.02, FALSE,
     'Precio de referencia por crédito unitario adicional')
ON CONFLICT DO NOTHING;

-- ── 3. Facturas de gasto IA (documento interno de lo que pagamos a proveedores)
CREATE TABLE IF NOT EXISTS facturas_gasto_ia (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT          UNIQUE,          -- 'GASTO-2026-06', auto-asignado al generar
  periodo_inicio  DATE          NOT NULL,
  periodo_fin     DATE          NOT NULL,
  total_usd       NUMERIC(12,4) NOT NULL DEFAULT 0,
  total_llamadas  INTEGER       NOT NULL DEFAULT 0,
  total_tokens    BIGINT        NOT NULL DEFAULT 0,
  -- Desglose por modelo: { "claude-sonnet-4-6": { llamadas, tokens_entrada, tokens_salida, costo_usd } }
  desglose_modelo JSONB         NOT NULL DEFAULT '{}',
  -- Desglose por tenant: { "ferreteria_id": { nombre, llamadas, costo_usd } }
  desglose_tenant JSONB         NOT NULL DEFAULT '{}',
  estado          TEXT          NOT NULL DEFAULT 'borrador'
                    CHECK (estado IN ('borrador', 'emitida', 'archivada')),
  notas           TEXT,
  generada_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  emitida_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_facturas_gasto_ia_periodo
  ON facturas_gasto_ia (periodo_inicio, periodo_fin);

CREATE INDEX IF NOT EXISTS idx_facturas_gasto_ia_estado
  ON facturas_gasto_ia (estado);
