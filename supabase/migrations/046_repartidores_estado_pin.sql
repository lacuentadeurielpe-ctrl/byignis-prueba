-- Migration 046: Columnas faltantes en repartidores
--
-- El API /api/settings-2/equipo/repartidores hace SELECT/INSERT de estado, pin y
-- zonas_asignadas, pero esas columnas no existían en la tabla. Esta migración las
-- añade de forma idempotente y sincroniza estado con el booleano activo existente.
-- El campo activo NO se elimina porque /api/repartidores (dropdown de pedidos) lo usa.

-- 1. estado: texto ('activo' | 'inactivo') equivalente al booleano activo
ALTER TABLE repartidores ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'activo';
UPDATE repartidores SET estado = CASE WHEN activo THEN 'activo' ELSE 'inactivo' END;

-- 2. pin: texto plano de 4 dígitos visible para el dueño al momento de crear
--    (distinto de pin_hash que usa PBKDF2 para el portal del repartidor)
ALTER TABLE repartidores ADD COLUMN IF NOT EXISTS pin TEXT;
UPDATE repartidores SET pin = (1000 + floor(random() * 9000))::TEXT WHERE pin IS NULL;

-- 3. zonas_asignadas: array de nombres/IDs de zonas de entrega asignadas
ALTER TABLE repartidores ADD COLUMN IF NOT EXISTS zonas_asignadas TEXT[] DEFAULT '{}';
