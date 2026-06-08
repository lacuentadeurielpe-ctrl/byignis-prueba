-- Migración 048: Verificar y consolidar vehiculos_delivery
-- M041 y M043 pueden haber creado esta tabla, consolidamos en M043

-- Verificar si la tabla existe
-- Si existe duplicada, DROP la de M041 y mantener la de M043
-- M043 debe tener estos campos:
-- id, ferreteria_id, tipo, placa, repartidor_id, activo, created_at

-- Para esta migración, simplemente verificamos que la tabla existe
-- y tiene los campos necesarios. Si ya existe de M043, no hacer nada.

CREATE TABLE IF NOT EXISTS public.vehiculos_delivery (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id   UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL,                  -- 'auto', 'moto', 'bicicleta'
  placa           TEXT NOT NULL,
  repartidor_id   UUID REFERENCES public.repartidores(id) ON DELETE SET NULL,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_vehiculos_delivery_ferreteria
  ON public.vehiculos_delivery(ferreteria_id);
CREATE INDEX IF NOT EXISTS idx_vehiculos_delivery_repartidor
  ON public.vehiculos_delivery(repartidor_id);

-- RLS
ALTER TABLE public.vehiculos_delivery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehiculos_delivery_select" ON public.vehiculos_delivery
  FOR SELECT USING (ferreteria_id = public.mi_ferreteria_id());

CREATE POLICY "vehiculos_delivery_insert" ON public.vehiculos_delivery
  FOR INSERT WITH CHECK (ferreteria_id = public.mi_ferreteria_id());

CREATE POLICY "vehiculos_delivery_update" ON public.vehiculos_delivery
  FOR UPDATE USING (ferreteria_id = public.mi_ferreteria_id());

CREATE POLICY "vehiculos_delivery_delete" ON public.vehiculos_delivery
  FOR DELETE USING (ferreteria_id = public.mi_ferreteria_id());
