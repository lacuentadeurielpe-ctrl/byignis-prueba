-- Migración: Habilitar RLS en las tablas restantes y definir sus políticas básicas
-- 1. Tabla: recargas_creditos
ALTER TABLE public.recargas_creditos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can do all on recargas_creditos" ON public.recargas_creditos
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
  );

CREATE POLICY "Owners can view their recargas_creditos" ON public.recargas_creditos
  FOR SELECT TO authenticated USING (
    ferreteria_id = (SELECT id FROM public.ferreterias WHERE owner_id = auth.uid() LIMIT 1)
  );

-- 2. Tabla: planes
ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view planes" ON public.planes
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Superadmins can do all on planes" ON public.planes
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
  );

-- 3. Tabla: repartidores
ALTER TABLE public.repartidores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can do all on repartidores" ON public.repartidores
  FOR ALL TO authenticated USING (
    ferreteria_id = (SELECT id FROM public.ferreterias WHERE owner_id = auth.uid() LIMIT 1)
  );

-- 4. Tabla: miembros_ferreteria
ALTER TABLE public.miembros_ferreteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can do all on miembros_ferreteria" ON public.miembros_ferreteria
  FOR ALL TO authenticated USING (
    ferreteria_id = (SELECT id FROM public.ferreterias WHERE owner_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Miembros can view their own record" ON public.miembros_ferreteria
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
  );

-- 5. Tabla: secuencias_pedido
ALTER TABLE public.secuencias_pedido ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can do all on secuencias_pedido" ON public.secuencias_pedido
  FOR ALL TO authenticated USING (
    ferreteria_id = (SELECT id FROM public.ferreterias WHERE owner_id = auth.uid() LIMIT 1)
  );
