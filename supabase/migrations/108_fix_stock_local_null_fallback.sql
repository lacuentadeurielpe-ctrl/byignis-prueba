-- Migración 108: Fallback a local principal en triggers de stock local
-- Si un pedido entra sin local_id (ej: integración legacy o e-commerce externo)
-- y la ferretería está en Modo B (stock por local), el stock se deducirá del local principal
-- para mantener la consistencia entre el stock global y la suma local.

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
  v_local      UUID;
BEGIN
  IF p_producto_id IS NULL OR p_delta = 0 THEN
    RETURN;
  END IF;

  SELECT ferreteria_id INTO v_ferreteria FROM productos WHERE id = p_producto_id;
  IF v_ferreteria IS NULL THEN RETURN; END IF;

  SELECT stock_por_local INTO v_modo_b FROM ferreterias WHERE id = v_ferreteria;
  IF NOT COALESCE(v_modo_b, false) THEN RETURN; END IF;

  v_local := p_local_id;
  IF v_local IS NULL THEN
    v_local := public.local_principal_id(v_ferreteria);
  END IF;

  IF v_local IS NULL THEN RETURN; END IF;

  INSERT INTO stock_locales (ferreteria_id, producto_id, local_id, stock)
  VALUES (v_ferreteria, p_producto_id, v_local, p_delta)
  ON CONFLICT (producto_id, local_id)
  DO UPDATE SET stock = stock_locales.stock + p_delta, updated_at = now();
END;
$$;
