-- ============================================================
-- 089_bandeja_crm.sql
-- Bandeja WhatsApp potenciada + CRM integrado
-- FASE 0: cimientos de datos
-- ============================================================

-- ── conversaciones: nuevas columnas para inbox ───────────────
ALTER TABLE conversaciones
  ADD COLUMN IF NOT EXISTS no_leido_count      INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estado_atencion     TEXT         NOT NULL DEFAULT 'abierta'
    CHECK (estado_atencion IN ('abierta','pendiente','esperando','resuelta')),
  ADD COLUMN IF NOT EXISTS archivada           BOOL         NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fijada              BOOL         NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS snooze_hasta        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS asignado_a          UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ultima_lectura_at   TIMESTAMPTZ;

-- ── mensajes: adjuntos, notas internas, reacciones ──────────
ALTER TABLE mensajes
  ADD COLUMN IF NOT EXISTS media_url       TEXT,
  ADD COLUMN IF NOT EXISTS media_tipo      TEXT
    CHECK (media_tipo IN ('imagen','video','audio','documento','sticker', NULL)),
  ADD COLUMN IF NOT EXISTS es_nota_interna BOOL  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS responde_a      UUID  REFERENCES mensajes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_nota       TEXT
    CHECK (tipo_nota IN ('nota','llamada','reunion','whatsapp', NULL)),
  ADD COLUMN IF NOT EXISTS reaccion        TEXT;

-- ── clientes: marketing + campos personalizados ──────────────
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS acepta_marketing BOOL         NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS campos_extra     JSONB        NOT NULL DEFAULT '{}';

-- ── ferreterias: switch maestro + horario + autos ────────────
ALTER TABLE ferreterias
  ADD COLUMN IF NOT EXISTS bot_global_activo   BOOL    NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS horario_atencion    JSONB   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mensajes_auto       JSONB   NOT NULL DEFAULT '{}';

-- ── etiquetas (labels de conversación) ───────────────────────
CREATE TABLE IF NOT EXISTS etiquetas (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id UUID        NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  nombre        TEXT        NOT NULL,
  color         TEXT        NOT NULL DEFAULT '#6366f1',
  orden         INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ferreteria_id, nombre)
);

CREATE TABLE IF NOT EXISTS conversacion_etiquetas (
  conversacion_id UUID NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  etiqueta_id     UUID NOT NULL REFERENCES etiquetas(id) ON DELETE CASCADE,
  asignado_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversacion_id, etiqueta_id)
);

-- ── respuestas rápidas (/atajo) ───────────────────────────────
CREATE TABLE IF NOT EXISTS respuestas_rapidas (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id UUID        NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  atajo         TEXT        NOT NULL,    -- e.g. "hola", "precio", "envio"
  contenido     TEXT        NOT NULL,
  categoria     TEXT,
  orden         INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ferreteria_id, atajo)
);

-- ── plantillas HSM (WhatsApp templates) ──────────────────────
CREATE TABLE IF NOT EXISTS plantillas_wa (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id    UUID        NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  nombre           TEXT        NOT NULL,
  categoria        TEXT        NOT NULL DEFAULT 'MARKETING'
    CHECK (categoria IN ('MARKETING','UTILITY','AUTHENTICATION')),
  idioma           TEXT        NOT NULL DEFAULT 'es',
  header_tipo      TEXT        CHECK (header_tipo IN ('TEXT','IMAGE','DOCUMENT','VIDEO', NULL)),
  header_contenido TEXT,
  cuerpo           TEXT        NOT NULL,
  footer           TEXT,
  botones          JSONB       NOT NULL DEFAULT '[]',
  variables        TEXT[]      NOT NULL DEFAULT '{}',
  -- Estado de aprobación Meta
  meta_template_id TEXT,
  meta_status      TEXT        NOT NULL DEFAULT 'borrador'
    CHECK (meta_status IN ('borrador','pendiente','aprobada','rechazada')),
  meta_rechazo_motivo TEXT,
  -- YCloud
  ycloud_template_name TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ferreteria_id, nombre)
);

-- ── campañas / difusiones ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS campanas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id  UUID        NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  nombre         TEXT        NOT NULL,
  plantilla_id   UUID        REFERENCES plantillas_wa(id) ON DELETE SET NULL,
  mensaje_libre  TEXT,               -- para ventana 24h abierta (sin plantilla)
  filtro_tags    TEXT[]      NOT NULL DEFAULT '{}',
  filtro_tipo    TEXT,               -- 'persona'|'empresa'|NULL=todos
  acepta_mkt_only BOOL       NOT NULL DEFAULT true,
  estado         TEXT        NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador','programada','enviando','completada','cancelada')),
  programada_at  TIMESTAMPTZ,
  iniciada_at    TIMESTAMPTZ,
  completada_at  TIMESTAMPTZ,
  total_destinos INT         NOT NULL DEFAULT 0,
  total_enviados INT         NOT NULL DEFAULT 0,
  total_errores  INT         NOT NULL DEFAULT 0,
  creado_por     UUID        REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campana_destinatarios (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id     UUID        NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
  cliente_id     UUID        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  estado         TEXT        NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','enviado','fallido','respondido')),
  error_detalle  TEXT,
  enviado_at     TIMESTAMPTZ,
  UNIQUE(campana_id, cliente_id)
);

-- ── push subscriptions (Web Push PWA) ────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ferreteria_id UUID        NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  endpoint      TEXT        NOT NULL,
  p256dh        TEXT        NOT NULL,
  auth          TEXT        NOT NULL,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- ── índices de rendimiento ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conversaciones_estado_atencion
  ON conversaciones (ferreteria_id, estado_atencion)
  WHERE archivada = false;

CREATE INDEX IF NOT EXISTS idx_conversaciones_no_leido
  ON conversaciones (ferreteria_id, no_leido_count DESC)
  WHERE no_leido_count > 0 AND archivada = false;

CREATE INDEX IF NOT EXISTS idx_conversaciones_asignado
  ON conversaciones (ferreteria_id, asignado_a)
  WHERE asignado_a IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversaciones_fijada
  ON conversaciones (ferreteria_id, fijada)
  WHERE fijada = true;

CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion_created
  ON mensajes (conversacion_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mensajes_nota_interna
  ON mensajes (conversacion_id)
  WHERE es_nota_interna = true;

CREATE INDEX IF NOT EXISTS idx_etiquetas_ferreteria
  ON etiquetas (ferreteria_id, orden);

CREATE INDEX IF NOT EXISTS idx_conv_etiquetas_etiqueta
  ON conversacion_etiquetas (etiqueta_id);

CREATE INDEX IF NOT EXISTS idx_campana_destinatarios_estado
  ON campana_destinatarios (campana_id, estado);

CREATE INDEX IF NOT EXISTS idx_push_subs_user
  ON push_subscriptions (user_id);

-- ── Trigger: auto-incrementar no_leido_count en mensajes de cliente ─────────
CREATE OR REPLACE FUNCTION fn_incrementar_no_leido()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role = 'cliente' AND NEW.es_nota_interna = false THEN
    UPDATE conversaciones
      SET no_leido_count = no_leido_count + 1
      WHERE id = NEW.conversacion_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_incrementar_no_leido ON mensajes;
CREATE TRIGGER tg_incrementar_no_leido
  AFTER INSERT ON mensajes
  FOR EACH ROW EXECUTE FUNCTION fn_incrementar_no_leido();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE etiquetas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversacion_etiquetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE respuestas_rapidas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas_wa          ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE campana_destinatarios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions     ENABLE ROW LEVEL SECURITY;

-- etiquetas
DROP POLICY IF EXISTS etiquetas_tenant ON etiquetas;
CREATE POLICY etiquetas_tenant ON etiquetas
  FOR ALL USING (ferreteria_id = mi_ferreteria_id());

-- conversacion_etiquetas: verificar via la conversación
DROP POLICY IF EXISTS conv_etiquetas_tenant ON conversacion_etiquetas;
CREATE POLICY conv_etiquetas_tenant ON conversacion_etiquetas
  FOR ALL USING (
    conversacion_id IN (
      SELECT id FROM conversaciones WHERE ferreteria_id = mi_ferreteria_id()
    )
  );

-- respuestas_rapidas
DROP POLICY IF EXISTS respuestas_rapidas_tenant ON respuestas_rapidas;
CREATE POLICY respuestas_rapidas_tenant ON respuestas_rapidas
  FOR ALL USING (ferreteria_id = mi_ferreteria_id());

-- plantillas_wa
DROP POLICY IF EXISTS plantillas_wa_tenant ON plantillas_wa;
CREATE POLICY plantillas_wa_tenant ON plantillas_wa
  FOR ALL USING (ferreteria_id = mi_ferreteria_id());

-- campanas
DROP POLICY IF EXISTS campanas_tenant ON campanas;
CREATE POLICY campanas_tenant ON campanas
  FOR ALL USING (ferreteria_id = mi_ferreteria_id());

-- campana_destinatarios: via campana
DROP POLICY IF EXISTS campana_dest_tenant ON campana_destinatarios;
CREATE POLICY campana_dest_tenant ON campana_destinatarios
  FOR ALL USING (
    campana_id IN (
      SELECT id FROM campanas WHERE ferreteria_id = mi_ferreteria_id()
    )
  );

-- push_subscriptions: solo el propio usuario
DROP POLICY IF EXISTS push_subs_own ON push_subscriptions;
CREATE POLICY push_subs_own ON push_subscriptions
  FOR ALL USING (user_id = auth.uid());
