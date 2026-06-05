-- Migración 034: Funciones de confirmación y anulación de recepción de compras
-- 1. Función para confirmar recepción de compra (incrementa stock y actualiza costo de compra)
CREATE OR REPLACE FUNCTION public.confirmar_recepcion_compra(
  p_ferreteria_id UUID,
  p_compra_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_estado TEXT;
  r RECORD;
BEGIN
  -- Obtener y bloquear la compra para evitar race conditions
  SELECT estado INTO v_estado
  FROM public.compras
  WHERE id = p_compra_id AND ferreteria_id = p_ferreteria_id
  FOR UPDATE;

  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'Compra no encontrada';
  END IF;

  IF v_estado != 'borrador' THEN
    RAISE EXCEPTION 'Solo se pueden confirmar compras en estado borrador. Estado actual: %', v_estado;
  END IF;

  -- Actualizar el stock y costo unitario de los productos asociados
  FOR r IN 
    SELECT producto_id, unidades_ingresadas_al_stock, precio_compra_unitario, conversion_a_unidades
    FROM public.items_compra
    WHERE compra_id = p_compra_id
  LOOP
    IF r.producto_id IS NOT NULL THEN
      UPDATE public.productos
      SET 
        stock = COALESCE(stock, 0) + r.unidades_ingresadas_al_stock,
        precio_compra = ROUND(r.precio_compra_unitario / COALESCE(r.conversion_a_unidades, 1), 2),
        updated_at = NOW()
      WHERE id = r.producto_id AND ferreteria_id = p_ferreteria_id;
    END IF;
  END LOOP;

  -- Cambiar el estado de la compra
  UPDATE public.compras
  SET estado = 'recibida', updated_at = NOW()
  WHERE id = p_compra_id AND ferreteria_id = p_ferreteria_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Función para anular recepción de compra (revierte stock)
CREATE OR REPLACE FUNCTION public.anular_recepcion_compra(
  p_ferreteria_id UUID,
  p_compra_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_estado TEXT;
  r RECORD;
BEGIN
  -- Obtener y bloquear la compra
  SELECT estado INTO v_estado
  FROM public.compras
  WHERE id = p_compra_id AND ferreteria_id = p_ferreteria_id
  FOR UPDATE;

  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'Compra no encontrada';
  END IF;

  IF v_estado != 'recibida' THEN
    RAISE EXCEPTION 'Solo se pueden anular compras recibidas. Estado actual: %', v_estado;
  END IF;

  -- Revertir el stock (restar las unidades ingresadas)
  FOR r IN 
    SELECT producto_id, unidades_ingresadas_al_stock
    FROM public.items_compra
    WHERE compra_id = p_compra_id
  LOOP
    IF r.producto_id IS NOT NULL THEN
      UPDATE public.productos
      SET 
        stock = GREATEST(0, COALESCE(stock, 0) - r.unidades_ingresadas_al_stock),
        updated_at = NOW()
      WHERE id = r.producto_id AND ferreteria_id = p_ferreteria_id;
    END IF;
  END LOOP;

  -- Cambiar el estado de la compra a anulada
  UPDATE public.compras
  SET estado = 'anulada', updated_at = NOW()
  WHERE id = p_compra_id AND ferreteria_id = p_ferreteria_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
