-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN 090 — SUNAT Directo: credenciales por tenant
-- Cada negocio puede conectar su propio certificado digital SUNAT
-- en lugar de usar Nubefact como intermediario.
-- ══════════════════════════════════════════════════════════════════

-- 1. Columna en ferreterias: qué proveedor de facturación usa
ALTER TABLE ferreterias
  ADD COLUMN IF NOT EXISTS proveedor_facturacion TEXT
    DEFAULT 'nubefact'
    CHECK (proveedor_facturacion IN ('nubefact', 'sunat_directo', 'ninguno'));

-- 2. Tabla de credenciales SUNAT directas por tenant
CREATE TABLE IF NOT EXISTS sunat_credenciales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id   UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,

  -- Datos del emisor (pueden diferir de ferreterias.ruc si hay sucursales)
  ruc             TEXT NOT NULL,
  razon_social    TEXT NOT NULL,

  -- Credenciales SUNAT SOL (usuario y clave del portal sol.sunat.gob.pe)
  -- Formato usuario SOL: el RUC + sufijo asignado (ej. MODDATOS)
  sol_usuario_enc TEXT NOT NULL,   -- encriptado AES-256-GCM
  sol_clave_enc   TEXT NOT NULL,   -- encriptado AES-256-GCM

  -- Certificado digital (PFX/P12 en base64, encriptado)
  cert_pfx_enc    TEXT NOT NULL,   -- encriptado AES-256-GCM (base64 del archivo .pfx)
  cert_clave_enc  TEXT NOT NULL,   -- encriptado AES-256-GCM (contraseña del .pfx)

  -- URL del microservicio Greenter (puede ser shared por plataforma o por tenant)
  greenter_url    TEXT NOT NULL DEFAULT 'https://greenter-api.byignis.com',

  -- Modo de operación
  modo            TEXT NOT NULL DEFAULT 'beta'
    CHECK (modo IN ('beta', 'produccion')),

  -- Estado de la integración
  estado          TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'homologando', 'activo', 'error')),

  -- Metadatos de homologación SUNAT
  -- SUNAT exige emitir 10 casos de prueba antes de pasar a producción
  homologacion_casos_completados  INTEGER NOT NULL DEFAULT 0,
  homologacion_completada_at      TIMESTAMPTZ,

  -- Último test de conexión
  ultimo_test_at  TIMESTAMPTZ,
  ultimo_error    TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sólo puede existir un conjunto de credenciales SUNAT por ferretería
CREATE UNIQUE INDEX IF NOT EXISTS sunat_credenciales_unique_ferreteria
  ON sunat_credenciales (ferreteria_id);

-- RLS: el tenant solo ve sus propias credenciales
ALTER TABLE sunat_credenciales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sunat_cred_select" ON sunat_credenciales;
DROP POLICY IF EXISTS "sunat_cred_insert" ON sunat_credenciales;
DROP POLICY IF EXISTS "sunat_cred_update" ON sunat_credenciales;
DROP POLICY IF EXISTS "sunat_cred_delete" ON sunat_credenciales;

CREATE POLICY "sunat_cred_select" ON sunat_credenciales
  FOR SELECT USING (ferreteria_id = mi_ferreteria_id());

CREATE POLICY "sunat_cred_insert" ON sunat_credenciales
  FOR INSERT WITH CHECK (ferreteria_id = mi_ferreteria_id());

CREATE POLICY "sunat_cred_update" ON sunat_credenciales
  FOR UPDATE USING (ferreteria_id = mi_ferreteria_id());

CREATE POLICY "sunat_cred_delete" ON sunat_credenciales
  FOR DELETE USING (ferreteria_id = mi_ferreteria_id());

-- Índice para joins desde ferreterias
CREATE INDEX IF NOT EXISTS idx_sunat_cred_ferreteria
  ON sunat_credenciales (ferreteria_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_sunat_credenciales_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_sunat_cred_updated_at ON sunat_credenciales;
CREATE TRIGGER trg_sunat_cred_updated_at
  BEFORE UPDATE ON sunat_credenciales
  FOR EACH ROW EXECUTE FUNCTION update_sunat_credenciales_updated_at();
