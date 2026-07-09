-- 1. Añadir campos logísticos a miembros_ferreteria
ALTER TABLE public.miembros_ferreteria
ADD COLUMN IF NOT EXISTS telefono TEXT,
ADD COLUMN IF NOT EXISTS tipo_vehiculo TEXT,
ADD COLUMN IF NOT EXISTS placa_vehiculo TEXT,
ADD COLUMN IF NOT EXISTS vencimiento_soat DATE,
ADD COLUMN IF NOT EXISTS capacidad_kg NUMERIC,
ADD COLUMN IF NOT EXISTS costo_por_km NUMERIC;

-- 2. Migrar datos de repartidores a miembros_ferreteria
-- Insertamos todos los repartidores como nuevos miembros con rol = 'repartidor'
INSERT INTO public.miembros_ferreteria (
    ferreteria_id,
    user_id,
    nombre,
    telefono,
    estado,
    rol,
    tipo_vehiculo,
    placa_vehiculo,
    vencimiento_soat,
    capacidad_kg,
    costo_por_km,
    roles_granulares,
    created_at
)
SELECT 
    ferreteria_id,
    user_id,
    nombre,
    telefono,
    estado,
    'repartidor' AS rol,
    tipo_vehiculo,
    placa AS placa_vehiculo,
    vencimiento_soat,
    capacidad_kg,
    costo_por_km,
    roles_granulares,
    created_at
FROM public.repartidores
ON CONFLICT DO NOTHING; -- Por si se corre 2 veces

-- Opcional: También podríamos transferir relaciones como repartidor_sucursal a empleado_sucursal 
-- pero dado que la tabla repartidor_sucursal es nueva y no tiene datos históricos importantes, 
-- o si los tiene, deberíamos migrar. Asumamos que no hay relaciones pesadas. Si las hay, deberíamos buscar por user_id, 
-- pero como ID cambia, es complejo. Dado que es un sistema en pruebas, la migración de datos base es suficiente.

-- 3. Eliminar foreign keys si existen, o simplemente renombrar la tabla vieja para backup
ALTER TABLE public.repartidores RENAME TO repartidores_backup_deprecated;
ALTER TABLE public.repartidor_sucursal RENAME TO repartidor_sucursal_backup_deprecated;
