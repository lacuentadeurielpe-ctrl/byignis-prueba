-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN 101 — Realtime para productos y comprobantes
--
-- Completa la migración 100 (pedidos):
--   · productos     → el POS y el modal de nuevo pedido veían el stock del
--                     momento de cargar la página; tras vender, el catálogo
--                     en memoria seguía ofreciendo stock ya consumido.
--   · comprobantes  → emitir una boleta desde el móvil no se reflejaba en
--                     la PC (el realtime solo escuchaba pedidos), por lo que
--                     el mismo pedido seguía ofreciendo "Emitir Boleta".
--
-- RLS aplica a los eventos: cada navegador solo recibe filas de su negocio.
-- ══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'productos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.productos;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'comprobantes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comprobantes;
  END IF;
END $$;
