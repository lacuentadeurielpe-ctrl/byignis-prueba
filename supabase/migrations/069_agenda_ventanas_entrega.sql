-- =============================================
-- Migration 069: Ventanas de entrega declaradas por el repartidor
--
-- El ETA al cliente deja de ser un punto calculado por algoritmo y pasa a ser
-- una VENTANA (intervalo inicio–fin) que el repartidor declara/encadena. El
-- repartidor es la autoridad: conoce las calles, la carga real y el tráfico.
--
-- La ventana canónica vive en `entregas` (la agenda es por vehículo). Se espeja
-- en `pedidos` porque las 3 superficies (bot, POS, Ventas) leen pedidos — mismo
-- patrón que la columna `eta_minutos` ya existente.
--
-- La agrupación de pedidos en un viaje ("las latas de arena de camino al
-- cemento") REUTILIZA lo existente: entregas.multi_reparto_id + posicion_ruta +
-- multi_repartos. No se crean tablas nuevas para eso.
-- =============================================

-- ── Ventana canónica en la entrega ────────────────────────────────────────────
ALTER TABLE public.entregas
  ADD COLUMN IF NOT EXISTS ventana_inicio     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ventana_fin        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ventana_origen     TEXT NOT NULL DEFAULT 'base',
  ADD COLUMN IF NOT EXISTS ventana_confirmada BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.entregas
  DROP CONSTRAINT IF EXISTS chk_entregas_ventana_origen;
ALTER TABLE public.entregas
  ADD CONSTRAINT chk_entregas_ventana_origen CHECK (
    ventana_origen IN ('base','encadenada','manual','programada','agrupada')
  );

-- ── Copia denormalizada en pedidos (lectura barata para bot/POS/Ventas) ───────
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS ventana_inicio     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ventana_fin        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ventana_confirmada BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Promedio que el repartidor mantiene (tamaño de bloque al encadenar) ───────
ALTER TABLE public.repartidores
  ADD COLUMN IF NOT EXISTS duracion_bloque_default_min INTEGER NOT NULL DEFAULT 30;

-- ── Config por tienda ─────────────────────────────────────────────────────────
ALTER TABLE public.ferreterias
  ADD COLUMN IF NOT EXISTS delivery_tiempo_base_min    INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS delivery_ventana_tamano_min INTEGER NOT NULL DEFAULT 30;

-- ── Índice para leer la agenda de un vehículo por día ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_entregas_ventana
  ON public.entregas (ferreteria_id, vehiculo_id, ventana_inicio);

-- ── Comentarios ───────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.entregas.ventana_inicio IS 'Inicio de la ventana de entrega prometida al cliente (fuente de verdad de la agenda)';
COMMENT ON COLUMN public.entregas.ventana_origen IS 'base|encadenada|manual|programada|agrupada — cómo se calculó la ventana';
COMMENT ON COLUMN public.entregas.ventana_confirmada IS 'TRUE si el repartidor confirmó la ventana (vs estimación provisional del sistema)';
COMMENT ON COLUMN public.repartidores.duracion_bloque_default_min IS 'Duración promedio por entrega que el repartidor mantiene; tamaño de bloque al encadenar';
COMMENT ON COLUMN public.ferreterias.delivery_tiempo_base_min IS 'Minutos desde ahora para el primer pedido cuando el vehículo está ocioso';
COMMENT ON COLUMN public.ferreterias.delivery_ventana_tamano_min IS 'Ancho por defecto de la ventana de entrega en minutos';
