-- =============================================
-- Migration 056: Sistema de Orquestación de Reparto
-- Cola inteligente, estados operativos, multi-reparto,
-- reprogramación, log de operaciones, factores de zona
-- =============================================

-- ============================================================
-- A) EXTENSIONES A TABLAS EXISTENTES
-- ============================================================

-- A1) vehiculos_delivery — specs operativos + estado
ALTER TABLE public.vehiculos_delivery
  ADD COLUMN IF NOT EXISTS nombre            TEXT,
  ADD COLUMN IF NOT EXISTS capacidad_kg      NUMERIC(8,2) DEFAULT 150,
  ADD COLUMN IF NOT EXISTS velocidad_kmh     NUMERIC(5,1) DEFAULT 30,
  ADD COLUMN IF NOT EXISTS estado            TEXT NOT NULL DEFAULT 'disponible',
  ADD COLUMN IF NOT EXISTS descripcion_averia TEXT,
  ADD COLUMN IF NOT EXISTS est_resolucion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS en_uso_desde      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT NOW();

-- Velocidades default por tipo
UPDATE public.vehiculos_delivery SET velocidad_kmh = 35 WHERE tipo = 'moto'     AND velocidad_kmh = 30;
UPDATE public.vehiculos_delivery SET velocidad_kmh = 25 WHERE tipo = 'bicicleta' AND velocidad_kmh = 30;
UPDATE public.vehiculos_delivery SET velocidad_kmh = 28 WHERE tipo = 'auto'      AND velocidad_kmh = 30;

-- Capacidades default por tipo
UPDATE public.vehiculos_delivery SET capacidad_kg = 80  WHERE tipo = 'moto'      AND capacidad_kg = 150;
UPDATE public.vehiculos_delivery SET capacidad_kg = 30  WHERE tipo = 'bicicleta' AND capacidad_kg = 150;
UPDATE public.vehiculos_delivery SET capacidad_kg = 400 WHERE tipo = 'auto'      AND capacidad_kg = 150;

ALTER TABLE public.vehiculos_delivery
  ADD CONSTRAINT chk_vehiculo_estado CHECK (
    estado IN ('disponible','en_uso','averia_leve','averia_grave','mantenimiento','fuera_servicio')
  );

-- A2) repartidores — estado operativo expandido
-- Primero eliminar el constraint existente que solo permite activo/inactivo
ALTER TABLE public.repartidores
  DROP CONSTRAINT IF EXISTS check_repartidor_estado;

ALTER TABLE public.repartidores
  ADD COLUMN IF NOT EXISTS estado_operativo  TEXT NOT NULL DEFAULT 'disponible',
  ADD COLUMN IF NOT EXISTS ultima_lat        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ultima_lng        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS gps_actualizado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disponible_desde  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS turno_inicio      TIME,
  ADD COLUMN IF NOT EXISTS turno_fin         TIME,
  ADD COLUMN IF NOT EXISTS max_pedidos_ruta  INTEGER DEFAULT 5;

ALTER TABLE public.repartidores
  ADD CONSTRAINT chk_repartidor_estado_operativo CHECK (
    estado_operativo IN (
      'disponible','en_ruta','entre_paradas','pausa',
      'no_disponible','averia','emergencia','fuera_turno'
    )
  );

-- Sincronizar estado_operativo con estado legacy
UPDATE public.repartidores
SET estado_operativo = CASE
  WHEN estado = 'activo' THEN 'disponible'
  ELSE 'no_disponible'
END
WHERE estado_operativo = 'disponible' OR estado_operativo IS NULL;

-- A3) entregas — orquestación avanzada
ALTER TABLE public.entregas
  ADD COLUMN IF NOT EXISTS prioridad          INTEGER NOT NULL DEFAULT 3 CHECK (prioridad BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS intentos_entrega   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_intentos       INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS multi_reparto_id   UUID,
  ADD COLUMN IF NOT EXISTS posicion_ruta      INTEGER,
  ADD COLUMN IF NOT EXISTS eta_calculado_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bloqueado_hasta_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_bloqueo     TEXT,
  ADD COLUMN IF NOT EXISTS notificado_cliente BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reagendado_para    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reagendado_motivo  TEXT,
  ADD COLUMN IF NOT EXISTS distancia_osrm_km  NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS duracion_osrm_min  INTEGER;

-- A4) pedidos — campo reprogramación
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS reprogramado_para  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reprogramado_motivo TEXT,
  ADD COLUMN IF NOT EXISTS reprogramado_veces INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reprogramado_at    TIMESTAMPTZ;

-- ============================================================
-- B) TABLA: delivery_queue — cola persistente de prioridad
-- ============================================================
CREATE TABLE IF NOT EXISTS public.delivery_queue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id     UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  pedido_id         UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  entrega_id        UUID REFERENCES public.entregas(id) ON DELETE SET NULL,

  -- Prioridad calculada (1=más urgente, 5=menos urgente)
  prioridad         INTEGER NOT NULL DEFAULT 3 CHECK (prioridad BETWEEN 1 AND 5),
  score             NUMERIC(10,4) DEFAULT 0,  -- score numérico para ordering fino

  -- Estado en cola
  estado            TEXT NOT NULL DEFAULT 'esperando',
  -- esperando | asignado | en_ruta | completado | fallido | reagendado | cancelado

  -- Restricciones de asignación
  vehiculo_tipo_req TEXT,              -- tipo de vehículo mínimo requerido
  peso_total_kg     NUMERIC(8,2),      -- para verificar capacidad
  zona_delivery_id  UUID REFERENCES public.zonas_delivery(id),
  repartidor_pref_id UUID REFERENCES public.repartidores(id) ON DELETE SET NULL,

  -- Ventana de tiempo (para pedidos programados)
  no_antes_de       TIMESTAMPTZ,       -- para pedidos programados
  no_despues_de     TIMESTAMPTZ,       -- deadline máximo (SLA)

  -- Bloqueos temporales
  bloqueado_hasta   TIMESTAMPTZ,       -- bloquear para reintentos
  intentos          INTEGER DEFAULT 0,
  max_intentos      INTEGER DEFAULT 3,

  -- Reprogramación
  reagendado_para   TIMESTAMPTZ,
  reagendado_motivo TEXT,
  reagendado_veces  INTEGER DEFAULT 0,

  -- Metadata
  notas_internas    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(ferreteria_id, pedido_id, estado) DEFERRABLE INITIALLY DEFERRED
);

-- ============================================================
-- C) TABLA: multi_repartos — rutas multi-parada agrupadas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.multi_repartos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id     UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  repartidor_id     UUID REFERENCES public.repartidores(id) ON DELETE SET NULL,
  vehiculo_id       UUID REFERENCES public.vehiculos_delivery(id) ON DELETE SET NULL,

  estado            TEXT NOT NULL DEFAULT 'planificado',
  -- planificado | activo | completado | cancelado | reagendado

  -- Ruta calculada por OSRM
  orden_paradas     JSONB DEFAULT '[]',  -- [{entrega_id, orden, eta_min, distancia_km}]
  distancia_total_km NUMERIC(8,2),
  duracion_total_min INTEGER,
  ruta_polyline     TEXT,               -- para mostrar en mapa

  -- Peso total vs capacidad
  peso_total_kg     NUMERIC(8,2),

  -- Tiempos
  planificado_para  TIMESTAMPTZ,
  salio_at          TIMESTAMPTZ,
  completado_at     TIMESTAMPTZ,

  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- D) TABLA: delivery_operaciones_log — log completo del sistema
-- ============================================================
CREATE TABLE IF NOT EXISTS public.delivery_operaciones_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id     UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,

  -- Tipo de operación
  tipo              TEXT NOT NULL,
  -- averia_vehiculo | averia_resuelta | repartidor_emergencia | repartidor_disponible
  -- reasignacion_auto | reasignacion_manual | pedido_reagendado | pedido_cancelado_ruta
  -- cliente_ausente | cliente_reintento | zona_bloqueada | demora_detectada
  -- multi_reparto_creado | multi_reparto_reoptimizado | escalacion_dueno
  -- workflow_iniciado | workflow_resuelto | notificacion_enviada

  -- Entidades afectadas
  entrega_id        UUID REFERENCES public.entregas(id) ON DELETE SET NULL,
  pedido_id         UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
  repartidor_id     UUID REFERENCES public.repartidores(id) ON DELETE SET NULL,
  vehiculo_id       UUID REFERENCES public.vehiculos_delivery(id) ON DELETE SET NULL,
  multi_reparto_id  UUID REFERENCES public.multi_repartos(id) ON DELETE SET NULL,

  -- Payload del evento
  detalle           JSONB NOT NULL DEFAULT '{}',
  -- Incluye: estado_anterior, estado_nuevo, motivo, accion_tomada, eta_impacto_min

  -- Quién lo generó
  origen            TEXT DEFAULT 'sistema',  -- sistema | repartidor | dueno | cliente | bot

  -- Resolución
  resuelto          BOOLEAN DEFAULT FALSE,
  resuelto_at       TIMESTAMPTZ,
  resuelto_por      TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- E) TABLA: delivery_zona_factores — factores históricos de zona
-- ============================================================
CREATE TABLE IF NOT EXISTS public.delivery_zona_factores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id     UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  zona_delivery_id  UUID NOT NULL REFERENCES public.zonas_delivery(id) ON DELETE CASCADE,

  dia_semana        INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_bloque       INTEGER NOT NULL CHECK (hora_bloque BETWEEN 0 AND 23),

  -- Contadores acumulados
  total_entregas    INTEGER DEFAULT 0,
  total_incidencias INTEGER DEFAULT 0,
  cliente_ausente   INTEGER DEFAULT 0,
  zona_cerrada      INTEGER DEFAULT 0,
  demoras_severas   INTEGER DEFAULT 0,  -- tardó > ETA × 1.5

  -- Factores calculados (0.0 - 2.0, donde 1.0 = normal)
  factor_incidencia NUMERIC(4,3) DEFAULT 1.0,  -- multiplica el ETA
  factor_demora     NUMERIC(4,3) DEFAULT 1.0,

  -- Tiempo extra promedio en minutos por incidencia en esta zona+hora
  penalizacion_min  INTEGER DEFAULT 0,

  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(ferreteria_id, zona_delivery_id, dia_semana, hora_bloque)
);

-- ============================================================
-- F) TABLA: delivery_reprogramaciones — historial de reprogramaciones
-- ============================================================
CREATE TABLE IF NOT EXISTS public.delivery_reprogramaciones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id     UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  pedido_id         UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  entrega_id        UUID REFERENCES public.entregas(id) ON DELETE SET NULL,

  -- Qué se reprogramó
  fecha_original    TIMESTAMPTZ NOT NULL,
  fecha_nueva       TIMESTAMPTZ NOT NULL,
  motivo            TEXT NOT NULL,
  -- averia_vehiculo | repartidor_no_disponible | cliente_solicitud
  -- zona_bloqueada | sin_recursos | pedido_cancelado_reemplazado | otro

  -- Quién lo decidió
  origen            TEXT DEFAULT 'sistema',  -- sistema | dueno | cliente
  aprobado_por_cliente BOOLEAN DEFAULT FALSE,
  notificado_cliente   BOOLEAN DEFAULT FALSE,

  -- Estado
  cumplida          BOOLEAN DEFAULT FALSE,
  cancelada         BOOLEAN DEFAULT FALSE,

  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- G) ÍNDICES
-- ============================================================

-- delivery_queue
CREATE INDEX IF NOT EXISTS idx_queue_ferreteria_estado
  ON public.delivery_queue(ferreteria_id, estado, prioridad, score DESC);
CREATE INDEX IF NOT EXISTS idx_queue_pedido
  ON public.delivery_queue(pedido_id);
CREATE INDEX IF NOT EXISTS idx_queue_zona
  ON public.delivery_queue(ferreteria_id, zona_delivery_id, estado);
CREATE INDEX IF NOT EXISTS idx_queue_no_antes
  ON public.delivery_queue(ferreteria_id, no_antes_de) WHERE estado = 'esperando';

-- multi_repartos
CREATE INDEX IF NOT EXISTS idx_multi_repartos_ferreteria
  ON public.multi_repartos(ferreteria_id, estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_multi_repartos_repartidor
  ON public.multi_repartos(repartidor_id, estado);

-- delivery_operaciones_log
CREATE INDEX IF NOT EXISTS idx_ops_log_ferreteria
  ON public.delivery_operaciones_log(ferreteria_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_log_tipo
  ON public.delivery_operaciones_log(ferreteria_id, tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_log_entrega
  ON public.delivery_operaciones_log(entrega_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_log_no_resuelto
  ON public.delivery_operaciones_log(ferreteria_id, resuelto) WHERE resuelto = FALSE;

-- delivery_zona_factores
CREATE INDEX IF NOT EXISTS idx_zona_factores_lookup
  ON public.delivery_zona_factores(ferreteria_id, zona_delivery_id, dia_semana, hora_bloque);

-- delivery_reprogramaciones
CREATE INDEX IF NOT EXISTS idx_reprog_pedido
  ON public.delivery_reprogramaciones(pedido_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reprog_ferreteria
  ON public.delivery_reprogramaciones(ferreteria_id, created_at DESC);

-- Índices nuevos en tablas existentes
CREATE INDEX IF NOT EXISTS idx_entregas_multi_reparto
  ON public.entregas(multi_reparto_id) WHERE multi_reparto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entregas_prioridad
  ON public.entregas(ferreteria_id, prioridad, estado);
CREATE INDEX IF NOT EXISTS idx_repartidores_estado_op
  ON public.repartidores(ferreteria_id, estado_operativo);
CREATE INDEX IF NOT EXISTS idx_vehiculos_estado
  ON public.vehiculos_delivery(ferreteria_id, estado);

-- ============================================================
-- H) RLS POLICIES
-- ============================================================

ALTER TABLE public.delivery_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queue_select" ON public.delivery_queue FOR SELECT USING (ferreteria_id = public.mi_ferreteria_id());
CREATE POLICY "queue_insert" ON public.delivery_queue FOR INSERT WITH CHECK (ferreteria_id = public.mi_ferreteria_id());
CREATE POLICY "queue_update" ON public.delivery_queue FOR UPDATE USING (ferreteria_id = public.mi_ferreteria_id());
CREATE POLICY "queue_delete" ON public.delivery_queue FOR DELETE USING (ferreteria_id = public.mi_ferreteria_id());

ALTER TABLE public.multi_repartos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "multi_repartos_all" ON public.multi_repartos FOR ALL USING (ferreteria_id = public.mi_ferreteria_id());

ALTER TABLE public.delivery_operaciones_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops_log_select" ON public.delivery_operaciones_log FOR SELECT USING (ferreteria_id = public.mi_ferreteria_id());
CREATE POLICY "ops_log_insert" ON public.delivery_operaciones_log FOR INSERT WITH CHECK (ferreteria_id = public.mi_ferreteria_id());

ALTER TABLE public.delivery_zona_factores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zona_factores_all" ON public.delivery_zona_factores FOR ALL USING (ferreteria_id = public.mi_ferreteria_id());

ALTER TABLE public.delivery_reprogramaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reprog_all" ON public.delivery_reprogramaciones FOR ALL USING (ferreteria_id = public.mi_ferreteria_id());

-- ============================================================
-- I) FUNCIÓN: calcular_score_cola
-- Calcula el score numérico de prioridad para ordering fino
-- Score más alto = más urgente
-- ============================================================
CREATE OR REPLACE FUNCTION public.calcular_score_cola(
  p_prioridad       INTEGER,
  p_created_at      TIMESTAMPTZ,
  p_no_antes_de     TIMESTAMPTZ,
  p_intentos        INTEGER,
  p_peso_kg         NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  v_score NUMERIC := 0;
  v_antiguedad_min NUMERIC;
  v_urgencia_ventana NUMERIC;
BEGIN
  -- Base: prioridad inversa (1=más urgente → mayor score)
  v_score := (6 - p_prioridad) * 1000;

  -- Antigüedad en cola (max 500 puntos por 60+ minutos esperando)
  v_antiguedad_min := EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 60;
  v_score := v_score + LEAST(v_antiguedad_min * 8, 500);

  -- Urgencia por ventana de tiempo (si tiene deadline)
  IF p_no_antes_de IS NOT NULL THEN
    v_urgencia_ventana := EXTRACT(EPOCH FROM (p_no_antes_de - NOW())) / 60;
    IF v_urgencia_ventana < 30 THEN
      v_score := v_score + 300;  -- menos de 30min para su ventana
    ELSIF v_urgencia_ventana < 60 THEN
      v_score := v_score + 150;
    END IF;
  END IF;

  -- Penalización por reintentos fallidos (bajan prioridad temporalmente)
  IF p_intentos > 0 THEN
    v_score := v_score - (p_intentos * 50);
  END IF;

  RETURN GREATEST(v_score, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- J) FUNCIÓN: registrar_operacion
-- Helper para insertar en delivery_operaciones_log
-- ============================================================
CREATE OR REPLACE FUNCTION public.registrar_operacion(
  p_ferreteria_id  UUID,
  p_tipo           TEXT,
  p_detalle        JSONB,
  p_entrega_id     UUID DEFAULT NULL,
  p_pedido_id      UUID DEFAULT NULL,
  p_repartidor_id  UUID DEFAULT NULL,
  p_vehiculo_id    UUID DEFAULT NULL,
  p_origen         TEXT DEFAULT 'sistema'
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.delivery_operaciones_log (
    ferreteria_id, tipo, detalle, entrega_id, pedido_id,
    repartidor_id, vehiculo_id, origen
  ) VALUES (
    p_ferreteria_id, p_tipo, p_detalle, p_entrega_id, p_pedido_id,
    p_repartidor_id, p_vehiculo_id, p_origen
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- K) TRIGGER: updated_at automático para tablas nuevas
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vehiculos_updated_at
  BEFORE UPDATE ON public.vehiculos_delivery
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_queue_updated_at
  BEFORE UPDATE ON public.delivery_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_multi_repartos_updated_at
  BEFORE UPDATE ON public.multi_repartos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- L) COMENTARIOS
-- ============================================================
COMMENT ON TABLE public.delivery_queue IS 'Cola persistente de prioridad para pedidos delivery pendientes de asignación';
COMMENT ON TABLE public.multi_repartos IS 'Rutas multi-parada: un repartidor, N entregas en un solo tramo optimizado';
COMMENT ON TABLE public.delivery_operaciones_log IS 'Log completo de operaciones del sistema de reparto para auditoría y dashboard';
COMMENT ON TABLE public.delivery_zona_factores IS 'Factores históricos de incidencias por zona+hora+día para penalizar ETA';
COMMENT ON TABLE public.delivery_reprogramaciones IS 'Historial de todas las reprogramaciones de pedidos por cualquier motivo';
COMMENT ON COLUMN public.delivery_queue.score IS 'Score numérico calculado por calcular_score_cola(). Mayor score = mayor urgencia';
COMMENT ON COLUMN public.entregas.prioridad IS '1=urgente, 2=alta, 3=normal, 4=baja, 5=programado sin urgencia';
COMMENT ON COLUMN public.vehiculos_delivery.estado IS 'disponible|en_uso|averia_leve|averia_grave|mantenimiento|fuera_servicio';
COMMENT ON COLUMN public.repartidores.estado_operativo IS 'disponible|en_ruta|entre_paradas|pausa|no_disponible|averia|emergencia|fuera_turno';
