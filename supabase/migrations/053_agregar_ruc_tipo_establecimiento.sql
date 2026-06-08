-- Agregar campos RUC y tipo_establecimiento a ferreterias

ALTER TABLE ferreterias
ADD COLUMN IF NOT EXISTS ruc VARCHAR(11),
ADD COLUMN IF NOT EXISTS tipo_establecimiento VARCHAR(50) DEFAULT 'ferreteria';

-- Crear índice para búsquedas por RUC (SUNAT)
CREATE INDEX IF NOT EXISTS idx_ferreterias_ruc ON ferreterias(ruc);

-- Comentarios para documentación
COMMENT ON COLUMN ferreterias.ruc IS 'RUC SUNAT - 11 dígitos sin guiones';
COMMENT ON COLUMN ferreterias.tipo_establecimiento IS 'Tipo de establecimiento: ferreteria, mayorista, minorista, distribuidor';
