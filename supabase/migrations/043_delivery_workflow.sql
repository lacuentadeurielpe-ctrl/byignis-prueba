-- Migration 043: Tabla entregas y workflow de delivery completo

-- ============================================================
-- 1. Tabla entregas - Orquestar delivery, repartidor, vehículo
-- ============================================================
CREATE TABLE IF NOT EXISTS entregas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id         UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  pedido_id             UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE UNIQUE,
  zona_delivery_id      UUID NOT NULL REFERENCES zonas_delivery(id) ON DELETE RESTRICT,
  repartidor_id         UUID REFERENCES repartidores(id) ON DELETE SET NULL,
  vehiculo_id           UUID REFERENCES vehiculos_delivery(id) ON DELETE SET NULL,

  -- Estado del delivery
  estado                TEXT NOT NULL DEFAULT 'asignado' CHECK (estado IN (
    'asignado',          -- Asignada a repartidor
    'en_camino',         -- Repartidor salió
    'entregado',         -- Cliente recibió
    'rechazado',         -- Cliente rechazó
    'devuelto',          -- Repartidor devolvió a ferretería
    'cancelado'          -- Entrega cancelada
  )),

  -- Timestamps
  asignado_at           TIMESTAMPTZ DEFAULT NOW(),
  salio_at              TIMESTAMPTZ,
  llego_at              TIMESTAMPTZ,

  -- Detalles de entrega
  direccion_entrega     TEXT NOT NULL,
  instrucciones         TEXT,

  -- GPS del repartidor
  gps_ultima_lat        DOUBLE PRECISION,
  gps_ultima_lng        DOUBLE PRECISION,
  gps_actualizado_at    TIMESTAMPTZ,

  -- Métricas
  distancia_km          NUMERIC(8,2),
  duracion_estimada_min INTEGER,
  duracion_real_min     INTEGER,

  -- Firma digital / comprobante
  comprobante_fotos     TEXT[],     -- URLs de fotos de entrega
  firma_cliente_url     TEXT,       -- URL de firma del cliente
  nota_entrega          TEXT,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE entregas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entregas_access" ON entregas
  FOR ALL USING (ferreteria_id = mi_ferreteria_id());

-- ============================================================
-- 2. Tabla vehiculos_delivery (si no existe)
-- ============================================================
CREATE TABLE IF NOT EXISTS vehiculos_delivery (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id UUID NOT NULL REFERENCES ferreterias(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL,  -- 'moto', 'auto', 'camioneta', etc
  placa         TEXT NOT NULL,
  repartidor_id UUID REFERENCES repartidores(id) ON DELETE SET NULL,
  activo        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vehiculos_delivery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehiculos_delivery_access" ON vehiculos_delivery
  FOR ALL USING (ferreteria_id = mi_ferreteria_id());

-- ============================================================
-- 3. Crear vista para pedidos que necesitan entrega asignada
-- ============================================================
CREATE OR REPLACE VIEW pedidos_sin_entrega AS
SELECT
  p.id,
  p.numero_pedido,
  p.nombre_cliente,
  p.telefono_cliente,
  p.zona_delivery_id,
  p.modalidad,
  p.estado,
  zd.nombre as zona_nombre,
  COUNT(e.id) as entregas_count
FROM pedidos p
LEFT JOIN zonas_delivery zd ON p.zona_delivery_id = zd.id
LEFT JOIN entregas e ON p.id = e.pedido_id
WHERE p.modalidad = 'delivery'
  AND p.estado IN ('confirmado', 'en_preparacion', 'listo_para_recojo')
  AND e.id IS NULL
GROUP BY p.id, zd.id
ORDER BY p.created_at ASC;

-- ============================================================
-- 4. Trigger para crear entrega cuando pedido es delivery + confirmado
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_crear_entrega_delivery()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el pedido cambia a 'confirmado' y es 'delivery', crear entrega
  IF NEW.modalidad = 'delivery'
    AND NEW.estado = 'confirmado'
    AND OLD.estado != 'confirmado'
    AND NEW.zona_delivery_id IS NOT NULL THEN

    INSERT INTO entregas (ferreteria_id, pedido_id, zona_delivery_id, direccion_entrega, estado)
    VALUES (
      NEW.ferreteria_id,
      NEW.id,
      NEW.zona_delivery_id,
      COALESCE(NEW.direccion_entrega, 'Sin dirección especificada'),
      'asignado'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pedido_crear_entrega
  AFTER UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION trigger_crear_entrega_delivery();

-- ============================================================
-- 5. Trigger para actualizar timestamp entrega cuando cambia estado
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_actualizar_entrega_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();

  IF NEW.estado = 'en_camino' AND OLD.estado != 'en_camino' THEN
    NEW.salio_at = NOW();
  END IF;

  IF NEW.estado = 'entregado' AND OLD.estado != 'entregado' THEN
    NEW.llego_at = NOW();
    IF NEW.salio_at IS NOT NULL THEN
      NEW.duracion_real_min = EXTRACT(EPOCH FROM (NOW() - NEW.salio_at)) / 60;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_entrega_timestamps
  BEFORE UPDATE ON entregas
  FOR EACH ROW EXECUTE FUNCTION trigger_actualizar_entrega_timestamps();

-- ============================================================
-- 6. Función para asignar entrega a repartidor
-- ============================================================
CREATE OR REPLACE FUNCTION asignar_entrega_a_repartidor(
  p_entrega_id UUID,
  p_repartidor_id UUID,
  p_vehiculo_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE entregas
  SET repartidor_id = p_repartidor_id,
      vehiculo_id = p_vehiculo_id,
      estado = 'asignado'
  WHERE id = p_entrega_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. Función para marcar entrega como en camino
-- ============================================================
CREATE OR REPLACE FUNCTION entrega_en_camino(p_entrega_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE entregas
  SET estado = 'en_camino',
      salio_at = NOW()
  WHERE id = p_entrega_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. Función para registrar entrega completada
-- ============================================================
CREATE OR REPLACE FUNCTION entrega_completada(
  p_entrega_id UUID,
  p_nota TEXT DEFAULT NULL,
  p_firma_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_entrega RECORD;
BEGIN
  SELECT * INTO v_entrega FROM entregas WHERE id = p_entrega_id;

  UPDATE entregas
  SET estado = 'entregado',
      llego_at = NOW(),
      nota_entrega = COALESCE(p_nota, nota_entrega),
      firma_cliente_url = COALESCE(p_firma_url, firma_cliente_url),
      duracion_real_min = EXTRACT(EPOCH FROM (NOW() - salio_at)) / 60
  WHERE id = p_entrega_id;

  -- Actualizar pedido a 'entregado'
  UPDATE pedidos
  SET estado = 'entregado'
  WHERE id = v_entrega.pedido_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 9. Crear índices para performance
-- ============================================================
CREATE INDEX idx_entregas_ferreteria ON entregas(ferreteria_id, estado);
CREATE INDEX idx_entregas_repartidor ON entregas(repartidor_id, estado);
CREATE INDEX idx_entregas_zona ON entregas(zona_delivery_id, estado);
CREATE INDEX idx_entregas_pedido ON entregas(pedido_id);
CREATE INDEX idx_vehiculos_ferreteria ON vehiculos_delivery(ferreteria_id);
CREATE INDEX idx_vehiculos_repartidor ON vehiculos_delivery(repartidor_id);
