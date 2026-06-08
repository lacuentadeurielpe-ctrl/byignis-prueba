-- Migration 043: Tablas base de delivery (entregas + vehiculos_delivery)
--
-- Refleja exactamente lo aplicado en la BD. La entrega NO se crea por trigger:
-- se crea de forma explícita en el endpoint de asignación de repartidor
-- (src/app/api/repartidores/[id]/asignar/route.ts), que es más controlable que
-- un trigger oculto.

-- ============================================================
-- entregas — orquesta pedido → repartidor → vehículo
-- ============================================================
CREATE TABLE IF NOT EXISTS entregas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id         UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  pedido_id             UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE UNIQUE,
  zona_delivery_id      UUID,
  repartidor_id         UUID REFERENCES repartidores(id) ON DELETE SET NULL,
  vehiculo_id           UUID,
  estado                TEXT NOT NULL DEFAULT 'asignado',
  asignado_at           TIMESTAMPTZ DEFAULT NOW(),
  salio_at              TIMESTAMPTZ,
  llego_at              TIMESTAMPTZ,
  direccion_entrega     TEXT NOT NULL,
  instrucciones         TEXT,
  gps_ultima_lat        DOUBLE PRECISION,
  gps_ultima_lng        DOUBLE PRECISION,
  gps_actualizado_at    TIMESTAMPTZ,
  distancia_km          NUMERIC(8,2),
  duracion_estimada_min INTEGER,
  duracion_real_min     INTEGER,
  comprobante_fotos     TEXT[],
  firma_cliente_url     TEXT,
  nota_entrega          TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE entregas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entregas_access" ON entregas FOR ALL USING (ferreteria_id = mi_ferreteria_id());

-- ============================================================
-- vehiculos_delivery — registro de vehículos para entregas
-- ============================================================
CREATE TABLE IF NOT EXISTS vehiculos_delivery (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL,
  placa         TEXT NOT NULL,
  repartidor_id UUID REFERENCES repartidores(id) ON DELETE SET NULL,
  activo        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE vehiculos_delivery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehiculos_delivery_access" ON vehiculos_delivery FOR ALL USING (ferreteria_id = mi_ferreteria_id());

CREATE INDEX IF NOT EXISTS idx_entregas_ferreteria ON entregas(ferreteria_id, estado);
CREATE INDEX IF NOT EXISTS idx_entregas_pedido ON entregas(pedido_id);
CREATE INDEX IF NOT EXISTS idx_vehiculos_ferreteria ON vehiculos_delivery(ferreteria_id);
