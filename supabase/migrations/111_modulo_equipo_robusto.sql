-- 1. Modificar tabla Empleados (miembros_ferreteria)
ALTER TABLE public.miembros_ferreteria
ADD COLUMN IF NOT EXISTS tipo_documento TEXT,
ADD COLUMN IF NOT EXISTS numero_documento TEXT,
ADD COLUMN IF NOT EXISTS regimen_pensionario TEXT,
ADD COLUMN IF NOT EXISTS banco_sueldo TEXT,
ADD COLUMN IF NOT EXISTS cci_sueldo TEXT,
ADD COLUMN IF NOT EXISTS fecha_ingreso DATE,
ADD COLUMN IF NOT EXISTS tipo_contrato TEXT,
ADD COLUMN IF NOT EXISTS roles_granulares JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_empleados_documento ON public.miembros_ferreteria(numero_documento);

-- 2. Modificar tabla Repartidores
ALTER TABLE public.repartidores
ADD COLUMN IF NOT EXISTS tipo_vehiculo TEXT,
ADD COLUMN IF NOT EXISTS placa_vehiculo TEXT,
ADD COLUMN IF NOT EXISTS vencimiento_soat DATE,
ADD COLUMN IF NOT EXISTS roles_granulares JSONB DEFAULT '[]'::jsonb;

-- 3. Tabla Pivot: Empleado - Sucursal (Multi-tenant interno)
CREATE TABLE IF NOT EXISTS public.empleado_sucursal (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    empleado_id UUID NOT NULL REFERENCES public.miembros_ferreteria(id) ON DELETE CASCADE,
    local_id UUID NOT NULL REFERENCES public.locales_ferreteria(id) ON DELETE CASCADE,
    ferreteria_id UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(empleado_id, local_id)
);

CREATE INDEX IF NOT EXISTS idx_empleado_sucursal_empleado ON public.empleado_sucursal(empleado_id);
CREATE INDEX IF NOT EXISTS idx_empleado_sucursal_local ON public.empleado_sucursal(local_id);

-- RLS para empleado_sucursal
ALTER TABLE public.empleado_sucursal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dueños y admins pueden ver sucursales de empleados" ON public.empleado_sucursal
    FOR ALL USING (ferreteria_id = (SELECT auth.jwt()->>'ferreteria_id')::uuid);

-- 4. Tabla Pivot: Repartidor - Sucursal
CREATE TABLE IF NOT EXISTS public.repartidor_sucursal (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    repartidor_id UUID NOT NULL REFERENCES public.repartidores(id) ON DELETE CASCADE,
    local_id UUID NOT NULL REFERENCES public.locales_ferreteria(id) ON DELETE CASCADE,
    ferreteria_id UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(repartidor_id, local_id)
);

CREATE INDEX IF NOT EXISTS idx_repartidor_sucursal_repartidor ON public.repartidor_sucursal(repartidor_id);
CREATE INDEX IF NOT EXISTS idx_repartidor_sucursal_local ON public.repartidor_sucursal(local_id);

-- RLS para repartidor_sucursal
ALTER TABLE public.repartidor_sucursal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dueños y admins pueden ver sucursales de repartidores" ON public.repartidor_sucursal
    FOR ALL USING (ferreteria_id = (SELECT auth.jwt()->>'ferreteria_id')::uuid);

-- 5. Tabla Documentos RRHH
CREATE TABLE IF NOT EXISTS public.documentos_rrhh (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ferreteria_id UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
    entidad_id UUID NOT NULL, -- UUID de empleado o repartidor
    entidad_tipo TEXT NOT NULL CHECK (entidad_tipo IN ('empleado', 'repartidor')),
    tipo_documento TEXT NOT NULL, -- 'contrato', 'dni', 'brevete', 'antecedentes', etc
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_documentos_rrhh_entidad ON public.documentos_rrhh(entidad_id);

ALTER TABLE public.documentos_rrhh ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dueños y admins pueden gestionar documentos de RRHH" ON public.documentos_rrhh
    FOR ALL USING (ferreteria_id = (SELECT auth.jwt()->>'ferreteria_id')::uuid);
