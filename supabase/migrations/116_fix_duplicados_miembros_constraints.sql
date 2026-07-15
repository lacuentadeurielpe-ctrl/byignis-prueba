-- Migración 116: Limpieza de duplicados + constraints de integridad
-- Diagnóstico profundo + corrección limpia y definitiva
--
-- FASES:
--   1. Diagnóstico (CTE de solo lectura)
--   2. Limpieza de duplicados en miembros_ferreteria
--   3. Limpieza de registros de owner-como-miembro redundantes
--   4. Corrección de correlativos desincronizados en sunat_series
--   5. Constraints UNIQUE preventivos (evitan que esto vuelva a ocurrir)
--
-- IDEMPOTENTE: se puede re-ejecutar sin efectos secundarios.

-- ═══════════════════════════════════════════════════════════════
-- FASE 1 — DIAGNÓSTICO (solo lectura, sin modificaciones)
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  n_duplicados_miembros INTEGER;
  n_owner_como_miembro  INTEGER;
  n_owners_duplicados   INTEGER;
  n_rucs_compartidos    INTEGER;
BEGIN
  -- 1a. Duplicados en miembros_ferreteria
  SELECT COUNT(*) INTO n_duplicados_miembros
  FROM (
    SELECT ferreteria_id, user_id
    FROM public.miembros_ferreteria
    WHERE user_id IS NOT NULL
    GROUP BY ferreteria_id, user_id
    HAVING COUNT(*) > 1
  ) sub;

  -- 1b. Owners que también aparecen como miembros en su propia ferretería
  SELECT COUNT(*) INTO n_owner_como_miembro
  FROM public.miembros_ferreteria m
  JOIN public.ferreterias f ON f.id = m.ferreteria_id AND f.owner_id = m.user_id;

  -- 1c. Owners con múltiples ferreterías
  SELECT COUNT(*) INTO n_owners_duplicados
  FROM (
    SELECT owner_id FROM public.ferreterias
    GROUP BY owner_id HAVING COUNT(*) > 1
  ) sub;

  -- 1d. RUCs compartidos entre ferreterías distintas
  SELECT COUNT(*) INTO n_rucs_compartidos
  FROM (
    SELECT ruc FROM public.sunat_credenciales
    GROUP BY ruc HAVING COUNT(DISTINCT ferreteria_id) > 1
  ) sub;

  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE 'DIAGNÓSTICO PRE-MIGRACIÓN 116';
  RAISE NOTICE '  Grupos duplicados en miembros_ferreteria : %', n_duplicados_miembros;
  RAISE NOTICE '  Owners que son también miembros (redundante): %', n_owner_como_miembro;
  RAISE NOTICE '  Owners con múltiples ferreterías         : %', n_owners_duplicados;
  RAISE NOTICE '  RUCs compartidos entre ferreterías       : %', n_rucs_compartidos;
  RAISE NOTICE '══════════════════════════════════════════════════════';

  IF n_owners_duplicados > 0 THEN
    RAISE WARNING 'Hay owners con múltiples ferreterías. El constraint UNIQUE(owner_id) NO se añadirá automáticamente — requiere decisión manual. Revisar con el script audit-duplicados.ts.';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- FASE 2 — LIMPIEZA DE DUPLICADOS EN miembros_ferreteria
-- Lógica de conservación:
--   1) Si hay uno activo → conservar el activo más antiguo
--   2) Si todos inactivos → conservar el más antiguo (created_at ASC)
--   Eliminar el resto.
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  n_eliminados INTEGER := 0;
BEGIN
  -- Identificar el ID a conservar por cada grupo duplicado
  WITH grupos_duplicados AS (
    SELECT ferreteria_id, user_id
    FROM public.miembros_ferreteria
    WHERE user_id IS NOT NULL
    GROUP BY ferreteria_id, user_id
    HAVING COUNT(*) > 1
  ),
  filas_rankeadas AS (
    SELECT
      m.id,
      m.ferreteria_id,
      m.user_id,
      -- Prioridad: activo primero, luego más antiguo
      ROW_NUMBER() OVER (
        PARTITION BY m.ferreteria_id, m.user_id
        ORDER BY
          CASE WHEN m.activo THEN 0 ELSE 1 END ASC,  -- activos primero
          m.created_at ASC                             -- más antiguo primero
      ) AS rn
    FROM public.miembros_ferreteria m
    INNER JOIN grupos_duplicados gd
      ON gd.ferreteria_id = m.ferreteria_id
     AND gd.user_id       = m.user_id
  ),
  ids_a_eliminar AS (
    SELECT id FROM filas_rankeadas WHERE rn > 1
  )
  DELETE FROM public.miembros_ferreteria
  WHERE id IN (SELECT id FROM ids_a_eliminar);

  GET DIAGNOSTICS n_eliminados = ROW_COUNT;

  RAISE NOTICE 'FASE 2: % fila(s) duplicada(s) eliminada(s) de miembros_ferreteria', n_eliminados;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- FASE 3 — ELIMINAR REGISTROS REDUNDANTES: owner como miembro
-- Si el dueño de la ferretería también aparece en miembros_ferreteria
-- de esa misma ferretería, ese registro es redundante y confunde
-- a getSessionInfo() (aunque en la práctica el check de owner gana
-- primero, es mejor no tener basura en la tabla).
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  n_eliminados INTEGER := 0;
BEGIN
  DELETE FROM public.miembros_ferreteria m
  WHERE EXISTS (
    SELECT 1 FROM public.ferreterias f
    WHERE f.id       = m.ferreteria_id
      AND f.owner_id = m.user_id
  );

  GET DIAGNOSTICS n_eliminados = ROW_COUNT;

  RAISE NOTICE 'FASE 3: % fila(s) owner-como-miembro eliminada(s)', n_eliminados;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- FASE 4 — SINCRONIZAR correlativos desincronizados
-- Si sunat_series.correlativo_actual < MAX(comprobantes.numero)
-- para esa misma combinación (ferreteria, tipo, serie), actualizarlo.
-- Esto evita que se vuelvan a emitir correlativos ya usados.
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  n_actualizados INTEGER := 0;
BEGIN
  WITH tipo_map(tipo_comprobante, tipo_doc) AS (
    VALUES
      ('boleta',       '03'),
      ('factura',      '01'),
      ('nota_credito', '07'),
      ('nota_debito',  '08')
  ),
  max_por_serie AS (
    SELECT
      c.ferreteria_id,
      tm.tipo_doc,
      c.serie,
      MAX(c.numero) AS max_numero
    FROM public.comprobantes c
    JOIN tipo_map tm ON tm.tipo_comprobante = c.tipo
    WHERE c.numero IS NOT NULL
      AND c.serie  IS NOT NULL
    GROUP BY c.ferreteria_id, tm.tipo_doc, c.serie
  )
  UPDATE public.sunat_series ss
  SET    correlativo_actual = m.max_numero
  FROM   max_por_serie m
  WHERE  ss.ferreteria_id      = m.ferreteria_id
    AND  ss.tipo_doc           = m.tipo_doc
    AND  ss.serie              = m.serie
    AND  ss.correlativo_actual < m.max_numero;

  GET DIAGNOSTICS n_actualizados = ROW_COUNT;

  RAISE NOTICE 'FASE 4: % serie(s) de sunat_series sincronizada(s) con correlativo real', n_actualizados;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- FASE 5 — AÑADIR CONSTRAINTS ÚNICOS PREVENTIVOS
-- Se añaden solo si no existen ya (idempotente).
-- ═══════════════════════════════════════════════════════════════

-- 5a. UNIQUE(ferreteria_id, user_id) en miembros_ferreteria
--     Impide que la migración 112 (o cualquier otra) vuelva a crear duplicados.
--     Aplica solo sobre user_id NOT NULL (repartidores sin cuenta pueden ser NULL).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.miembros_ferreteria'::regclass
      AND conname  = 'uq_miembros_ferreteria_user'
  ) THEN
    -- Usamos un partial unique index en lugar de constraint para manejar user_id NULL correctamente
    EXECUTE $sql$
      CREATE UNIQUE INDEX uq_miembros_ferreteria_user
      ON public.miembros_ferreteria (ferreteria_id, user_id)
      WHERE user_id IS NOT NULL
    $sql$;
    RAISE NOTICE 'FASE 5a: Índice único uq_miembros_ferreteria_user creado';
  ELSE
    RAISE NOTICE 'FASE 5a: uq_miembros_ferreteria_user ya existe — sin cambios';
  END IF;
END;
$$;

-- 5b. UNIQUE(owner_id) en ferreterias
--     Solo se crea si no hay owners con múltiples ferreterías (verificado arriba).
--     Si los hay, esta fase se salta con un aviso claro.
DO $$
DECLARE
  n_owners_multi INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_owners_multi
  FROM (
    SELECT owner_id FROM public.ferreterias
    GROUP BY owner_id HAVING COUNT(*) > 1
  ) sub;

  IF n_owners_multi > 0 THEN
    RAISE WARNING 'FASE 5b: Hay % owner(s) con múltiples ferreterías — constraint UNIQUE(owner_id) NO aplicado. Resolver manualmente.', n_owners_multi;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ferreterias'::regclass
      AND conname  = 'uq_ferreterias_owner'
  ) THEN
    ALTER TABLE public.ferreterias
      ADD CONSTRAINT uq_ferreterias_owner UNIQUE (owner_id);
    RAISE NOTICE 'FASE 5c: Constraint uq_ferreterias_owner añadido a ferreterias';
  ELSE
    RAISE NOTICE 'FASE 5b: uq_ferreterias_owner ya existe — sin cambios';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN FINAL — Confirmar que no quedan duplicados
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  n_duplicados_restantes INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_duplicados_restantes
  FROM (
    SELECT ferreteria_id, user_id
    FROM public.miembros_ferreteria
    WHERE user_id IS NOT NULL
    GROUP BY ferreteria_id, user_id
    HAVING COUNT(*) > 1
  ) sub;

  IF n_duplicados_restantes = 0 THEN
    RAISE NOTICE 'VERIFICACIÓN FINAL: ✅ Sin duplicados en miembros_ferreteria. Migración 116 completada con éxito.';
  ELSE
    RAISE EXCEPTION 'VERIFICACIÓN FINAL: ❌ Aún quedan % grupo(s) duplicados. La migración no limpió correctamente — revisar manualmente.', n_duplicados_restantes;
  END IF;
END;
$$;
