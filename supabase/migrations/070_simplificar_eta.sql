-- Migración 070: Simplificar ETA — el repartidor es la autoridad
-- Reemplaza las ventanas (inicio/fin/origen/confirmada) por un campo simple:
-- hora_fin_declarada en entregas + eta_timestamp en pedidos (espejo para lecturas rápidas).

-- ── entregas ──────────────────────────────────────────────────────────────────
ALTER TABLE public.entregas
  DROP COLUMN IF EXISTS ventana_inicio,
  DROP COLUMN IF EXISTS ventana_fin,
  DROP COLUMN IF EXISTS ventana_origen,
  DROP COLUMN IF EXISTS ventana_confirmada,
  ADD COLUMN IF NOT EXISTS hora_fin_declarada TIMESTAMPTZ;

-- ── pedidos ───────────────────────────────────────────────────────────────────
ALTER TABLE public.pedidos
  DROP COLUMN IF EXISTS ventana_inicio,
  DROP COLUMN IF EXISTS ventana_fin,
  DROP COLUMN IF EXISTS ventana_confirmada,
  ADD COLUMN IF NOT EXISTS eta_timestamp TIMESTAMPTZ;

-- ── repartidores ──────────────────────────────────────────────────────────────
ALTER TABLE public.repartidores
  DROP COLUMN IF EXISTS duracion_bloque_default_min;

-- ── ferreterias ───────────────────────────────────────────────────────────────
-- delivery_tiempo_base_min se CONSERVA (= los "+30 min" configurables)
ALTER TABLE public.ferreterias
  DROP COLUMN IF EXISTS delivery_ventana_tamano_min;

-- Índice para calcular max(hora_fin_declarada) por vehículo rápido
CREATE INDEX IF NOT EXISTS idx_entregas_hora_fin
  ON public.entregas (ferreteria_id, vehiculo_id, hora_fin_declarada)
  WHERE hora_fin_declarada IS NOT NULL;
