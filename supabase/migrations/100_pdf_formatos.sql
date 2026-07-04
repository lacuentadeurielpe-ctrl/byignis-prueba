-- Add PDF format and style configuration columns to ferreterias table

ALTER TABLE ferreterias
  ADD COLUMN IF NOT EXISTS pdf_formato_boleta TEXT DEFAULT 'clasico' CHECK (pdf_formato_boleta IN ('clasico','moderno','compacto')),
  ADD COLUMN IF NOT EXISTS pdf_formato_factura TEXT DEFAULT 'clasico' CHECK (pdf_formato_factura IN ('clasico','moderno','compacto')),
  ADD COLUMN IF NOT EXISTS pdf_formato_nota_venta TEXT DEFAULT 'ticket' CHECK (pdf_formato_nota_venta IN ('ticket','a5','compacto')),
  ADD COLUMN IF NOT EXISTS pdf_color_secundario TEXT DEFAULT '#e67e22';

-- Ensure the existing logo_url is preserved, we are just adding new columns
