-- Migración 038: Añadir regla estricta de nombres únicos para productos
-- 1. Renombrar posibles duplicados existentes para evitar errores al crear el índice.
-- Se mantiene el producto más antiguo original, y a los siguientes se les añade un sufijo.
WITH ranked_duplicates AS (
  SELECT id, nombre,
         ROW_NUMBER() OVER (
           PARTITION BY ferreteria_id, LOWER(TRIM(nombre)) 
           ORDER BY created_at ASC
         ) as rn
  FROM public.productos
)
UPDATE public.productos p
SET 
  nombre = p.nombre || ' (Duplicado ' || (rd.rn - 1)::text || ')',
  updated_at = NOW()
FROM ranked_duplicates rd
WHERE p.id = rd.id AND rd.rn > 1;

-- 2. Crear el índice único (case-insensitive y sin espacios extra en los extremos)
CREATE UNIQUE INDEX IF NOT EXISTS unique_producto_nombre_ferreteria
ON public.productos (ferreteria_id, LOWER(TRIM(nombre)));
