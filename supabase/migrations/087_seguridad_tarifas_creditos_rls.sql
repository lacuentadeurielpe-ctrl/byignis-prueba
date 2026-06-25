-- 087_seguridad_tarifas_creditos_rls.sql
-- tarifas_creditos no tenía RLS habilitado y tiene 4 filas de datos de precios.
-- Ningún código de tenant la consulta, pero es buena práctica bloquearlo.
-- Solo el service_role (createAdminClient) puede acceder.

ALTER TABLE public.tarifas_creditos ENABLE ROW LEVEL SECURITY;

-- Sin políticas explícitas = nadie con RLS puede leer (solo service_role bypassa RLS)
