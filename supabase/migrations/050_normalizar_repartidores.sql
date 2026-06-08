-- Migración 050: Normalizar repartidores
-- Mantener activo (legacy) pero agregar constraint en estado
-- estado debe ser 'activo' o 'inactivo' como canonical

-- Comentario: activo BOOLEAN coexiste con estado TEXT
-- Esto es temporal para backward compatibility
-- El nuevo código debe usar estado TEXT como canonical

-- Asegurar que todos los repartidores tengan estado consistente
-- Si ya existe estado, no hacer nada
-- Si no existe, crear desde activo

UPDATE public.repartidores
SET estado = CASE
  WHEN activo = true THEN 'activo'
  ELSE 'inactivo'
END
WHERE estado IS NULL OR estado = '';

-- Agregar constraint simple (sin enum para flexibility):
-- El estado debe ser uno de: 'activo', 'inactivo'
-- Implementado via CHECK constraint

ALTER TABLE public.repartidores
  ADD CONSTRAINT check_repartidor_estado
  CHECK (estado IN ('activo', 'inactivo'))
  NOT VALID;

-- VALIDATE CONSTRAINT puede fallar si hay datos inválidos
-- Si falla, revisar repartidores con estado inválido primero:
-- SELECT * FROM repartidores WHERE estado NOT IN ('activo', 'inactivo');

ALTER TABLE public.repartidores VALIDATE CONSTRAINT check_repartidor_estado;

-- Crear índice para búsquedas por estado
CREATE INDEX IF NOT EXISTS idx_repartidores_ferreteria_estado
  ON public.repartidores(ferreteria_id, estado);

-- Nota: zonas_asignadas TEXT[] se mantiene por ahora
-- En M052 crearemos tabla repartidor_zonas (N:N) como replacement
