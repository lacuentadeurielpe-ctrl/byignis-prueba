-- Migración 107: Stock por sucursal (Modo B) + fix restaurar_stock_parcial
-- Plan: docs/PLAN_SUCURSALES.md — FASE 4
--
-- Diseño:
--  * productos.stock SIGUE siendo el total global del tenant (lo que ya leen
--    POS, bot y catálogo). Los triggers lo mantienen igual que siempre.
--  * stock_locales guarda la DISTRIBUCIÓN por sucursal. Solo se mantiene si
--    ferreterias.stock_por_local = true (Modo B). Con el flag apagado la
--    tabla simplemente no se toca — cero cambios de comportamiento.
--  * El pedido conoce su sucursal (pedidos.local_id); los triggers de stock
--    ajustan la fila (producto, local) del pedido además del total global.
--
-- FIX incluido: el RPC restaurar_stock_parcial que llama la Nota de Crédito
-- (devolución de ítems) NUNCA existió — la restauración fallaba en silencio.

-- ============================================================
-- 1. Flag Modo B + tablas
-- ============================================================

ALTER TABLE public.ferreterias
  ADD COLUMN IF NOT EXISTS stock_por_local BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ferreterias.stock_por_local IS
  'Modo B: cada sucursal tiene su propio stock (tabla stock_locales). Apagado = stock global compartido (Modo A, clásico).';

CREATE TABLE IF NOT EXISTS public.stock_locales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  producto_id   UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  local_id      UUID NOT NULL REFERENCES public.locales_ferreteria(id) ON DELETE CASCADE,
  stock         NUMERIC NOT NULL DEFAULT 0,
  stock_minimo  NUMERIC NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (producto_id, local_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_locales_ferreteria_local
  ON public.stock_locales (ferreteria_id, local_id);

ALTER TABLE public.stock_locales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_locales_select ON public.stock_locales;
CREATE POLICY stock_locales_select ON public.stock_locales
  FOR SELECT USING (ferreteria_id = mi_ferreteria_id());
DROP POLICY IF EXISTS stock_locales_insert ON public.stock_locales;
CREATE POLICY stock_locales_insert ON public.stock_locales
  FOR INSERT WITH CHECK (ferreteria_id = mi_ferreteria_id());
DROP POLICY IF EXISTS stock_locales_update ON public.stock_locales;
CREATE POLICY stock_locales_update ON public.stock_locales
  FOR UPDATE USING (ferreteria_id = mi_ferreteria_id());
DROP POLICY IF EXISTS stock_locales_delete ON public.stock_locales;
CREATE POLICY stock_locales_delete ON public.stock_locales
  FOR DELETE USING (ferreteria_id = mi_ferreteria_id());

CREATE TABLE IF NOT EXISTS public.transferencias_stock (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id UUID NOT NULL REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  local_origen  UUID NOT NULL REFERENCES public.locales_ferreteria(id),
  local_destino UUID NOT NULL REFERENCES public.locales_ferreteria(id),
  estado        TEXT NOT NULL DEFAULT 'recibida'
    CHECK (estado IN ('pendiente','en_transito','recibida','cancelada')),
  items         JSONB NOT NULL,   -- [{producto_id, nombre, cantidad}]
  creado_por    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  recibida_at   TIMESTAMPTZ,
  CHECK (local_origen <> local_destino)
);

CREATE INDEX IF NOT EXISTS idx_transferencias_stock_ferreteria
  ON public.transferencias_stock (ferreteria_id, created_at DESC);

ALTER TABLE public.transferencias_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transferencias_stock_select ON public.transferencias_stock;
CREATE POLICY transferencias_stock_select ON public.transferencias_stock
  FOR SELECT USING (ferreteria_id = mi_ferreteria_id());
DROP POLICY IF EXISTS transferencias_stock_insert ON public.transferencias_stock;
CREATE POLICY transferencias_stock_insert ON public.transferencias_stock
  FOR INSERT WITH CHECK (ferreteria_id = mi_ferreteria_id());

-- ============================================================
-- 2. Helper interno: ajustar stock de una sucursal
--    (no falla si el tenant está en Modo A o el pedido no tiene local)
-- ============================================================

CREATE OR REPLACE FUNCTION public.stock_local_ajustar(
  p_producto_id UUID,
  p_local_id    UUID,
  p_delta       NUMERIC
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ferreteria UUID;
  v_modo_b     BOOLEAN;
BEGIN
  IF p_producto_id IS NULL OR p_local_id IS NULL OR p_delta = 0 THEN
    RETURN;
  END IF;

  SELECT ferreteria_id INTO v_ferreteria FROM productos WHERE id = p_producto_id;
  IF v_ferreteria IS NULL THEN RETURN; END IF;

  SELECT stock_por_local INTO v_modo_b FROM ferreterias WHERE id = v_ferreteria;
  IF NOT COALESCE(v_modo_b, false) THEN RETURN; END IF;

  INSERT INTO stock_locales (ferreteria_id, producto_id, local_id, stock)
  VALUES (v_ferreteria, p_producto_id, p_local_id, p_delta)
  ON CONFLICT (producto_id, local_id)
  DO UPDATE SET stock = stock_locales.stock + p_delta, updated_at = now();
END;
$$;

-- ============================================================
-- 3. Triggers de stock extendidos (misma lógica global de siempre
--    + espejo por sucursal cuando aplica)
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_ajustar_stock_items_pedido()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_estado TEXT;
  v_local  UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT estado, local_id INTO v_estado, v_local FROM pedidos WHERE id = NEW.pedido_id;
    IF v_estado NOT IN ('cancelado', 'devuelto') THEN
      IF NEW.producto_id IS NOT NULL THEN
        UPDATE productos SET stock = stock - NEW.cantidad WHERE id = NEW.producto_id;
        PERFORM stock_local_ajustar(NEW.producto_id, v_local, -NEW.cantidad);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT estado, local_id INTO v_estado, v_local FROM pedidos WHERE id = OLD.pedido_id;
    IF v_estado NOT IN ('cancelado', 'devuelto') THEN
      IF OLD.producto_id IS NOT NULL THEN
        UPDATE productos SET stock = stock + OLD.cantidad WHERE id = OLD.producto_id;
        PERFORM stock_local_ajustar(OLD.producto_id, v_local, OLD.cantidad);
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT estado, local_id INTO v_estado, v_local FROM pedidos WHERE id = NEW.pedido_id;
    IF OLD.producto_id IS DISTINCT FROM NEW.producto_id THEN
      IF v_estado NOT IN ('cancelado', 'devuelto') THEN
        IF OLD.producto_id IS NOT NULL THEN
          UPDATE productos SET stock = stock + OLD.cantidad WHERE id = OLD.producto_id;
          PERFORM stock_local_ajustar(OLD.producto_id, v_local, OLD.cantidad);
        END IF;
        IF NEW.producto_id IS NOT NULL THEN
          UPDATE productos SET stock = stock - NEW.cantidad WHERE id = NEW.producto_id;
          PERFORM stock_local_ajustar(NEW.producto_id, v_local, -NEW.cantidad);
        END IF;
      END IF;
    ELSE
      IF OLD.cantidad != NEW.cantidad THEN
        IF v_estado NOT IN ('cancelado', 'devuelto') THEN
          IF NEW.producto_id IS NOT NULL THEN
            UPDATE productos SET stock = stock + OLD.cantidad - NEW.cantidad WHERE id = NEW.producto_id;
            PERFORM stock_local_ajustar(NEW.producto_id, v_local, OLD.cantidad - NEW.cantidad);
          END IF;
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_ajustar_stock_estado_pedido()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
BEGIN
  -- Cancelado/devuelto (desde activo) -> DEVOLVER stock
  IF NEW.estado IN ('cancelado', 'devuelto') AND OLD.estado NOT IN ('cancelado', 'devuelto') THEN
    FOR r IN SELECT producto_id, SUM(cantidad) AS cant FROM items_pedido
             WHERE pedido_id = NEW.id AND producto_id IS NOT NULL GROUP BY producto_id
    LOOP
      UPDATE productos SET stock = stock + r.cant WHERE id = r.producto_id;
      PERFORM stock_local_ajustar(r.producto_id, NEW.local_id, r.cant);
    END LOOP;
  END IF;

  -- Reactivado (desde cancelado/devuelto) -> RESTAR stock
  IF NEW.estado NOT IN ('cancelado', 'devuelto') AND OLD.estado IN ('cancelado', 'devuelto') THEN
    FOR r IN SELECT producto_id, SUM(cantidad) AS cant FROM items_pedido
             WHERE pedido_id = NEW.id AND producto_id IS NOT NULL GROUP BY producto_id
    LOOP
      UPDATE productos SET stock = stock - r.cant WHERE id = r.producto_id;
      PERFORM stock_local_ajustar(r.producto_id, NEW.local_id, -r.cant);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. FIX: restaurar_stock_parcial (lo llama la NC de devolución
--    y NUNCA existió — la restauración fallaba en silencio)
-- ============================================================

CREATE OR REPLACE FUNCTION public.restaurar_stock_parcial(
  p_producto_id UUID,
  p_cantidad    NUMERIC,
  p_local_id    UUID DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_producto_id IS NULL OR p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RETURN;
  END IF;
  UPDATE productos SET stock = stock + p_cantidad WHERE id = p_producto_id;
  PERFORM stock_local_ajustar(p_producto_id, p_local_id, p_cantidad);
END;
$$;

-- ============================================================
-- 5. Activación del Modo B: sembrar la distribución inicial
--    (todo el stock actual va al local principal)
-- ============================================================

CREATE OR REPLACE FUNCTION public.activar_stock_por_local(p_ferreteria_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_principal UUID;
BEGIN
  v_principal := local_principal_id(p_ferreteria_id);
  IF v_principal IS NULL THEN
    RAISE EXCEPTION 'El negocio no tiene local principal';
  END IF;

  INSERT INTO stock_locales (ferreteria_id, producto_id, local_id, stock)
  SELECT p.ferreteria_id, p.id, v_principal, COALESCE(p.stock, 0)
  FROM productos p
  WHERE p.ferreteria_id = p_ferreteria_id
  ON CONFLICT (producto_id, local_id) DO NOTHING;

  UPDATE ferreterias SET stock_por_local = true WHERE id = p_ferreteria_id;
END;
$$;

-- ============================================================
-- 6. Transferencia atómica entre sucursales
-- ============================================================

CREATE OR REPLACE FUNCTION public.transferir_stock(
  p_ferreteria_id UUID,
  p_local_origen  UUID,
  p_local_destino UUID,
  p_items         JSONB,   -- [{producto_id, cantidad}]
  p_creado_por    TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  item          JSONB;
  v_producto    UUID;
  v_cantidad    NUMERIC;
  v_disponible  NUMERIC;
  v_nombre      TEXT;
  v_items_doc   JSONB := '[]'::jsonb;
  v_id          UUID;
BEGIN
  IF p_local_origen = p_local_destino THEN
    RAISE EXCEPTION 'El origen y el destino no pueden ser la misma sucursal';
  END IF;
  -- Ambos locales deben pertenecer al tenant
  IF (SELECT count(*) FROM locales_ferreteria
      WHERE id IN (p_local_origen, p_local_destino)
        AND ferreteria_id = p_ferreteria_id) <> 2 THEN
    RAISE EXCEPTION 'Sucursal no encontrada';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_producto := (item->>'producto_id')::uuid;
    v_cantidad := (item->>'cantidad')::numeric;
    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida en la transferencia';
    END IF;

    SELECT nombre INTO v_nombre FROM productos
    WHERE id = v_producto AND ferreteria_id = p_ferreteria_id;
    IF v_nombre IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado';
    END IF;

    -- Bloquea la fila de origen para evitar carreras
    SELECT stock INTO v_disponible FROM stock_locales
    WHERE producto_id = v_producto AND local_id = p_local_origen
    FOR UPDATE;

    IF COALESCE(v_disponible, 0) < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente de "%" en la sucursal de origen (disponible: %)',
        v_nombre, COALESCE(v_disponible, 0);
    END IF;

    UPDATE stock_locales SET stock = stock - v_cantidad, updated_at = now()
    WHERE producto_id = v_producto AND local_id = p_local_origen;

    INSERT INTO stock_locales (ferreteria_id, producto_id, local_id, stock)
    VALUES (p_ferreteria_id, v_producto, p_local_destino, v_cantidad)
    ON CONFLICT (producto_id, local_id)
    DO UPDATE SET stock = stock_locales.stock + v_cantidad, updated_at = now();

    v_items_doc := v_items_doc || jsonb_build_object(
      'producto_id', v_producto, 'nombre', v_nombre, 'cantidad', v_cantidad);
  END LOOP;

  INSERT INTO transferencias_stock
    (ferreteria_id, local_origen, local_destino, estado, items, creado_por, recibida_at)
  VALUES
    (p_ferreteria_id, p_local_origen, p_local_destino, 'recibida', v_items_doc, p_creado_por, now())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
