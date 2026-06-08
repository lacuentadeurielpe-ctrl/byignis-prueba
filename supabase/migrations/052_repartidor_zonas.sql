-- Migración 052: Crear tabla repartidor_zonas (N:N)
-- Reemplaza zonas_asignadas TEXT[] array con tabla normalizada
-- Permite: un repartidor puede ser asignado a múltiples zonas
--          una zona puede tener múltiples repartidores

-- ============================================================
-- Tabla principal
-- ============================================================

CREATE TABLE IF NOT EXISTS public.repartidor_zonas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repartidor_id   UUID NOT NULL REFERENCES public.repartidores(id) ON DELETE CASCADE,
  zona_delivery_id UUID NOT NULL REFERENCES public.zonas_delivery(id) ON DELETE CASCADE,

  -- Único constraint: un repartidor no puede duplicar zona
  UNIQUE(repartidor_id, zona_delivery_id),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Índices
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_repartidor_zonas_repartidor
  ON public.repartidor_zonas(repartidor_id);

CREATE INDEX IF NOT EXISTS idx_repartidor_zonas_zona
  ON public.repartidor_zonas(zona_delivery_id);

CREATE INDEX IF NOT EXISTS idx_repartidor_zonas_ferreteria
  ON public.repartidor_zonas(repartidor_id, zona_delivery_id);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.repartidor_zonas ENABLE ROW LEVEL SECURITY;

-- SELECT: acceso solo si el repartidor pertenece a mi ferretería
CREATE POLICY "repartidor_zonas_select" ON public.repartidor_zonas
  FOR SELECT USING (
    repartidor_id IN (
      SELECT id FROM public.repartidores
      WHERE ferreteria_id = public.mi_ferreteria_id()
    )
  );

-- INSERT: solo puedo asignar zonas a repartidores de mi ferretería
CREATE POLICY "repartidor_zonas_insert" ON public.repartidor_zonas
  FOR INSERT WITH CHECK (
    repartidor_id IN (
      SELECT id FROM public.repartidores
      WHERE ferreteria_id = public.mi_ferreteria_id()
    )
  );

-- UPDATE: no editable (usar delete + insert si cambiar)
CREATE POLICY "repartidor_zonas_update" ON public.repartidor_zonas
  FOR UPDATE USING (
    repartidor_id IN (
      SELECT id FROM public.repartidores
      WHERE ferreteria_id = public.mi_ferreteria_id()
    )
  );

-- DELETE: solo puedo eliminar asignaciones de mi ferretería
CREATE POLICY "repartidor_zonas_delete" ON public.repartidor_zonas
  FOR DELETE USING (
    repartidor_id IN (
      SELECT id FROM public.repartidores
      WHERE ferreteria_id = public.mi_ferreteria_id()
    )
  );

-- ============================================================
-- Migración de datos (opcional)
-- ============================================================

-- Si existen repartidores con zonas_asignadas como array,
-- migrar a tabla repartidor_zonas:
-- INSERT INTO repartidor_zonas (repartidor_id, zona_delivery_id)
-- SELECT
--   r.id,
--   zd.id
-- FROM public.repartidores r
-- CROSS JOIN public.zonas_delivery zd
-- WHERE zd.nombre = ANY(r.zonas_asignadas)
--   AND r.zonas_asignadas IS NOT NULL
--   AND r.zonas_asignadas != '{}'
-- ON CONFLICT (repartidor_id, zona_delivery_id) DO NOTHING;

-- Nota: Implementar migración de datos si existen registros históricos
-- Por ahora dejar comentado (datos legacy en zonas_asignadas se mantienen)

-- ============================================================
-- Comentario
-- ============================================================

-- Notas sobre el diseño:
-- 1. ON DELETE CASCADE en repartidor_id: si eliminas repartidor, se borran sus zonas
-- 2. ON DELETE CASCADE en zona_delivery_id: si eliminas zona, se borran asignaciones
-- 3. UNIQUE(repartidor_id, zona_delivery_id): evita duplicados
-- 4. RLS basado en ferretería_id del repartidor
-- 5. Es read-only después de creada (no edits, solo delete+insert)
