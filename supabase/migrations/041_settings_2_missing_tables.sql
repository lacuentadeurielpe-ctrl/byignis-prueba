-- Migration 041: Tablas faltantes para Settings 2.0
-- Crea las tablas que los APIs de settings-2 usan pero que no existían en la migración 040

-- ============================================================
-- 1. categorias_producto
-- ============================================================
CREATE TABLE IF NOT EXISTS categorias_producto (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  descripcion   TEXT NOT NULL DEFAULT '',
  icono         TEXT NOT NULL DEFAULT '📦',
  orden         INT NOT NULL DEFAULT 999,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE categorias_producto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categorias_select" ON categorias_producto
  FOR SELECT USING (ferreteria_id = mi_ferreteria_id());

CREATE POLICY "categorias_insert" ON categorias_producto
  FOR INSERT WITH CHECK (ferreteria_id = mi_ferreteria_id());

CREATE POLICY "categorias_update" ON categorias_producto
  FOR UPDATE USING (ferreteria_id = mi_ferreteria_id());

CREATE POLICY "categorias_delete" ON categorias_producto
  FOR DELETE USING (ferreteria_id = mi_ferreteria_id());

-- ============================================================
-- 2. descuentos_tiers
-- ============================================================
CREATE TABLE IF NOT EXISTS descuentos_tiers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id        UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  cantidad_minima      NUMERIC(10,2) NOT NULL,
  descuento_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 0,
  precio_fijo          NUMERIC(10,2),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE descuentos_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tiers_select" ON descuentos_tiers
  FOR SELECT USING (ferreteria_id = mi_ferreteria_id());

CREATE POLICY "tiers_insert" ON descuentos_tiers
  FOR INSERT WITH CHECK (ferreteria_id = mi_ferreteria_id());

CREATE POLICY "tiers_delete" ON descuentos_tiers
  FOR DELETE USING (ferreteria_id = mi_ferreteria_id());

-- ============================================================
-- 3. unidades_medida
-- ============================================================
CREATE TABLE IF NOT EXISTS unidades_medida (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id   UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  conversion_base NUMERIC(10,4) NOT NULL DEFAULT 1,
  es_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE unidades_medida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unidades_select" ON unidades_medida
  FOR SELECT USING (ferreteria_id = mi_ferreteria_id());

CREATE POLICY "unidades_insert" ON unidades_medida
  FOR INSERT WITH CHECK (ferreteria_id = mi_ferreteria_id());

CREATE POLICY "unidades_delete" ON unidades_medida
  FOR DELETE USING (ferreteria_id = mi_ferreteria_id());

-- ============================================================
-- 4. vehiculos_delivery
-- ============================================================
CREATE TABLE IF NOT EXISTS vehiculos_delivery (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id  UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL,
  placa          TEXT NOT NULL,
  repartidor_id  UUID REFERENCES repartidores(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vehiculos_delivery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehiculos_select" ON vehiculos_delivery
  FOR SELECT USING (ferreteria_id = mi_ferreteria_id());

CREATE POLICY "vehiculos_insert" ON vehiculos_delivery
  FOR INSERT WITH CHECK (ferreteria_id = mi_ferreteria_id());

CREATE POLICY "vehiculos_delete" ON vehiculos_delivery
  FOR DELETE USING (ferreteria_id = mi_ferreteria_id());
