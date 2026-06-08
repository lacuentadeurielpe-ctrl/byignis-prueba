-- Migración 049: Extender zonas_delivery con costo, cobertura y descripción

ALTER TABLE public.zonas_delivery
  ADD COLUMN IF NOT EXISTS costo_base NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- Nota: cobertura_polygon se omiтe por ahora
-- PostGIS requiere extensión GEOGRAPHY/GEOMETRY que puede no estar habilitada
-- Implementar como tabla separada zonas_poligonos si es necesario

-- Comentario sobre la estrategia:
-- Para cubiertas/polígonos, si en futuro se necesita:
-- 1. Habilitar postgis en Supabase
-- 2. Crear tabla zonas_cobertura con GEOMETRY
-- 3. Usar función ST_Contains para verificar si dirección cliente está en zona
-- Por ahora, usar nombre/descripción y mapeo manual

-- Índice para búsquedas por zona
CREATE INDEX IF NOT EXISTS idx_zonas_delivery_ferreteria_activo
  ON public.zonas_delivery(ferreteria_id, activo);
