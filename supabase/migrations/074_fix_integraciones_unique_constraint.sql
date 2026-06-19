-- La migración 040 creó integraciones_conectadas sin el constraint UNIQUE(ferreteria_id, tipo).
-- La migración 064 usó CREATE TABLE IF NOT EXISTS que no lo agrega si la tabla ya existe.
-- Este fix lo garantiza via ALTER TABLE + deduplicación previa.

-- 1. Dedupe: si hay filas duplicadas (ferreteria_id, tipo), conservar la más reciente
DELETE FROM public.integraciones_conectadas
WHERE id NOT IN (
  SELECT DISTINCT ON (ferreteria_id, tipo) id
  FROM public.integraciones_conectadas
  ORDER BY ferreteria_id, tipo, updated_at DESC NULLS LAST
);

-- 2. Agregar el constraint si no existe ya
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.integraciones_conectadas'::regclass
      AND contype = 'u'
      AND conname = 'integraciones_conectadas_ferreteria_id_tipo_key'
  ) THEN
    ALTER TABLE public.integraciones_conectadas
      ADD CONSTRAINT integraciones_conectadas_ferreteria_id_tipo_key
      UNIQUE (ferreteria_id, tipo);
  END IF;
END $$;

-- 3. Asegurar que integracion_logs tiene política de INSERT para que las rutas API puedan loggear
-- (Migration 040 solo tenía SELECT; migration 064 tenía ALL pero puede no haber aplicado)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integracion_logs'
      AND policyname = 'integracion_logs_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "integracion_logs_insert" ON public.integracion_logs
        FOR INSERT WITH CHECK (ferreteria_id = mi_ferreteria_id())
    $policy$;
  END IF;
END $$;
