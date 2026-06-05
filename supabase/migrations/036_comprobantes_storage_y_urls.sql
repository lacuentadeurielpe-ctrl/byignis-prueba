-- Añadir arreglo de URLs a compras
ALTER TABLE compras
ADD COLUMN IF NOT EXISTS imagenes_adjuntas text[] DEFAULT '{}';

-- Crear bucket en Storage si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes_ai', 'comprobantes_ai', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de RLS para el Bucket (Public Read, Authenticated Write)
CREATE POLICY "Acceso publico de lectura"
ON storage.objects FOR SELECT
USING ( bucket_id = 'comprobantes_ai' );

CREATE POLICY "Insercion de usuarios autenticados"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'comprobantes_ai' );

CREATE POLICY "Eliminacion de usuarios autenticados"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'comprobantes_ai' );
