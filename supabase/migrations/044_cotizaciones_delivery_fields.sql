-- Migration 044: Agregar campos de delivery a cotizaciones
-- Permite capturar preferencia de entrega en cotización

-- ============================================================
-- 1. Agregar campos a tabla cotizaciones
-- ============================================================
ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS modalidad TEXT DEFAULT 'recojo' CHECK (modalidad IN ('delivery', 'recojo')),
  ADD COLUMN IF NOT EXISTS zona_delivery_id UUID REFERENCES zonas_delivery(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS direccion_entrega TEXT,
  ADD COLUMN IF NOT EXISTS es_conversion_directa BOOLEAN DEFAULT FALSE;  -- true si se convirtió sin pasar por aprobación

-- ============================================================
-- 2. Crear índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cotizaciones_modalidad ON cotizaciones(ferreteria_id, modalidad);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_zona ON cotizaciones(zona_delivery_id);
