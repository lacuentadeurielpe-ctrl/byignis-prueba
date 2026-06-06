-- Migración 037: Renombrar imagenes_adjuntas a archivos_adjuntos y añadir índice de duplicados

-- Renombrar columna para que sea genérica (acepta imágenes y PDFs)
ALTER TABLE public.compras 
  RENAME COLUMN imagenes_adjuntas TO archivos_adjuntos;

-- Índice para búsqueda rápida de duplicados por número de factura dentro de un tenant
CREATE INDEX IF NOT EXISTS idx_compras_numero_factura_ferreteria
  ON public.compras (ferreteria_id, numero_factura)
  WHERE numero_factura IS NOT NULL;
