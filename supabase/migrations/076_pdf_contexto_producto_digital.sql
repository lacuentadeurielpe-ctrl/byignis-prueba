-- Agrega la URL del PDF de referencia que la IA usará para generar el contexto de ventas
ALTER TABLE productos_digitales
  ADD COLUMN IF NOT EXISTS pdf_contexto_url TEXT;
