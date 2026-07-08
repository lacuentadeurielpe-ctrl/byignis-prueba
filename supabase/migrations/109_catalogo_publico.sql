-- Migración 109: Infraestructura para Catálogo Público

-- 1. Soporte de imágenes en productos
ALTER TABLE public.productos 
  ADD COLUMN IF NOT EXISTS imagenes JSONB DEFAULT '[]'::jsonb;

-- 2. Configuración pública del catálogo por Tenant
ALTER TABLE public.ferreterias 
  ADD COLUMN IF NOT EXISTS catalogo_slug TEXT UNIQUE;

ALTER TABLE public.ferreterias 
  ADD COLUMN IF NOT EXISTS catalogo_config JSONB 
  DEFAULT '{"mostrar_precios": true, "mostrar_sin_stock": false, "mostrar_descripciones": true, "mostrar_imagenes": true, "mostrar_bulk_pricing": true}'::jsonb;

-- 3. Crear el bucket en Storage para las imágenes (si no existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'productos-imagenes', 
  'productos-imagenes', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Políticas de Seguridad (RLS) para el bucket de imágenes
-- Permitir lectura a todo el mundo (catálogo público)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public_read_productos_imagenes' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY public_read_productos_imagenes ON storage.objects
      FOR SELECT USING (bucket_id = 'productos-imagenes');
  END IF;
END
$$;

-- Permitir inserción/actualización/borrado a usuarios logueados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'auth_insert_productos_imagenes' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY auth_insert_productos_imagenes ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'productos-imagenes');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'auth_update_productos_imagenes' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY auth_update_productos_imagenes ON storage.objects
      FOR UPDATE TO authenticated USING (bucket_id = 'productos-imagenes');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'auth_delete_productos_imagenes' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY auth_delete_productos_imagenes ON storage.objects
      FOR DELETE TO authenticated USING (bucket_id = 'productos-imagenes');
  END IF;
END
$$;
