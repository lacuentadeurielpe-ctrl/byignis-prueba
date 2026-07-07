-- Migración 106: Fundamentos de sucursales (multi-local por tenant)
-- Plan: docs/PLAN_SUCURSALES.md — FASE 1
--
-- Principios:
--  * ferreteria_id sigue siendo LA frontera de seguridad (RLS intacto).
--  * local_id es dimensión intra-tenant, NULLABLE en todas las tablas:
--    NULL = local principal / dato legado. Nada se rompe con el flag apagado.
--  * pedidos y entregas YA tienen local_id (migración 051) — no se tocan.

-- ============================================================
-- 1. Flag por tenant + código de establecimiento SUNAT
-- ============================================================

ALTER TABLE public.ferreterias
  ADD COLUMN IF NOT EXISTS multi_sucursal BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ferreterias.multi_sucursal IS
  'Activa la operación multi-local: selector de sucursal, series por local, scoping de empleados. Apagado = comportamiento de tienda única.';

ALTER TABLE public.locales_ferreteria
  ADD COLUMN IF NOT EXISTS codigo_sunat TEXT NOT NULL DEFAULT '0000',
  -- Series de comprobantes propias del local. NULL = usa las series del tenant
  -- (ferreterias.serie_boletas / serie_facturas), que es el comportamiento actual.
  ADD COLUMN IF NOT EXISTS serie_boletas    TEXT,
  ADD COLUMN IF NOT EXISTS serie_facturas   TEXT,
  ADD COLUMN IF NOT EXISTS serie_nc_boleta  TEXT,
  ADD COLUMN IF NOT EXISTS serie_nc_factura TEXT,
  ADD COLUMN IF NOT EXISTS serie_nd_boleta  TEXT,
  ADD COLUMN IF NOT EXISTS serie_nd_factura TEXT;

COMMENT ON COLUMN public.locales_ferreteria.codigo_sunat IS
  'Código de establecimiento anexo en la Ficha RUC (0000 = domicilio fiscal, 0001+ = anexos). Va como codLocal en el XML.';

-- ============================================================
-- 2. Backfill: todo tenant tiene EXACTAMENTE un local principal
-- ============================================================

-- 2a. Tenants sin ningún local → crear el principal desde los datos del tenant
INSERT INTO public.locales_ferreteria (ferreteria_id, nombre, direccion, telefono, es_principal, activo)
SELECT f.id, COALESCE(f.nombre, 'Local principal'), COALESCE(f.direccion, 'Por definir'), f.telefono_whatsapp, true, true
FROM public.ferreterias f
WHERE NOT EXISTS (
  SELECT 1 FROM public.locales_ferreteria lf WHERE lf.ferreteria_id = f.id
);

-- 2b. Tenants con locales pero ninguno marcado principal → promover el más antiguo
UPDATE public.locales_ferreteria lf
SET es_principal = true
WHERE lf.id = (
  SELECT lf2.id FROM public.locales_ferreteria lf2
  WHERE lf2.ferreteria_id = lf.ferreteria_id
  ORDER BY lf2.created_at ASC LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM public.locales_ferreteria lf3
  WHERE lf3.ferreteria_id = lf.ferreteria_id AND lf3.es_principal = true
);

-- 2c. Tenants con MÁS de un principal → conservar solo el más antiguo
UPDATE public.locales_ferreteria lf
SET es_principal = false
WHERE lf.es_principal = true
AND lf.id <> (
  SELECT lf2.id FROM public.locales_ferreteria lf2
  WHERE lf2.ferreteria_id = lf.ferreteria_id AND lf2.es_principal = true
  ORDER BY lf2.created_at ASC LIMIT 1
);

-- 2d. Garantía a futuro: único principal por tenant
CREATE UNIQUE INDEX IF NOT EXISTS uniq_local_principal_por_tenant
  ON public.locales_ferreteria (ferreteria_id)
  WHERE es_principal = true;

-- ============================================================
-- 3. Helper: local principal de un tenant
-- ============================================================

CREATE OR REPLACE FUNCTION public.local_principal_id(p_ferreteria_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.locales_ferreteria
  WHERE ferreteria_id = p_ferreteria_id AND es_principal = true
  LIMIT 1;
$$;

-- ============================================================
-- 4. local_id en tablas operativas restantes (nullable + índice)
--    pedidos/entregas ya lo tienen (051).
-- ============================================================

ALTER TABLE public.comprobantes
  ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES public.locales_ferreteria(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_comprobantes_ferreteria_local
  ON public.comprobantes (ferreteria_id, local_id);

ALTER TABLE public.rendiciones
  ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES public.locales_ferreteria(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_rendiciones_ferreteria_local
  ON public.rendiciones (ferreteria_id, local_id);

ALTER TABLE public.pagos_registrados
  ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES public.locales_ferreteria(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_pagos_registrados_ferreteria_local
  ON public.pagos_registrados (ferreteria_id, local_id);

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES public.locales_ferreteria(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_compras_ferreteria_local
  ON public.compras (ferreteria_id, local_id);

ALTER TABLE public.vehiculos
  ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES public.locales_ferreteria(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_vehiculos_ferreteria_local
  ON public.vehiculos (ferreteria_id, local_id);

ALTER TABLE public.vehiculos_delivery
  ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES public.locales_ferreteria(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_vehiculos_delivery_ferreteria_local
  ON public.vehiculos_delivery (ferreteria_id, local_id);

ALTER TABLE public.zonas_delivery
  ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES public.locales_ferreteria(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_zonas_delivery_ferreteria_local
  ON public.zonas_delivery (ferreteria_id, local_id);

ALTER TABLE public.repartidores
  ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES public.locales_ferreteria(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_repartidores_ferreteria_local
  ON public.repartidores (ferreteria_id, local_id);

-- Sucursal asignada del empleado. NULL = acceso a todas (dueño/gerente general).
ALTER TABLE public.miembros_ferreteria
  ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES public.locales_ferreteria(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_miembros_ferreteria_local
  ON public.miembros_ferreteria (ferreteria_id, local_id);

-- ============================================================
-- 5. Series SUNAT: dimensión local (el RPC de reserva no cambia —
--    sigue siendo atómico por (ferreteria_id, tipo_doc, serie)).
-- ============================================================

ALTER TABLE public.sunat_series
  ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES public.locales_ferreteria(id) ON DELETE SET NULL;

-- Una serie pertenece a lo sumo a UN local dentro del tenant: la unicidad
-- (ferreteria_id, tipo_doc, serie) ya existe como PK/unique de la tabla,
-- por lo que basta con que dos locales no declaren la misma serie en
-- locales_ferreteria. Guardia en capa de aplicación + este índice de apoyo:
CREATE INDEX IF NOT EXISTS idx_sunat_series_local
  ON public.sunat_series (ferreteria_id, local_id);
