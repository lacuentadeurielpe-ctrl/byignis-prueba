-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN 100 — Realtime para pedidos
--
-- La publicación supabase_realtime estaba VACÍA: ningún cambio de tabla
-- llegaba al navegador, por lo que la vista de Ventas requería recargar
-- la página para ver pedidos nuevos o cambios de estado.
--
-- Se publica solo `pedidos`: es la tabla que las 3 superficies (Ventas,
-- POS, bot) escriben y la única que la UI necesita en vivo. Los eventos
-- postgres_changes respetan RLS, así que cada navegador solo recibe los
-- pedidos de su propio negocio.
-- ══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pedidos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
  END IF;
END $$;
