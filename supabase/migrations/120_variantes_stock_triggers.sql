-- Actualización de triggers para descontar stock de variantes además de productos principales

CREATE OR REPLACE FUNCTION public.trigger_ajustar_stock_items_pedido()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_estado TEXT;
  v_local  UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT estado, local_id INTO v_estado, v_local FROM pedidos WHERE id = NEW.pedido_id;
    IF v_estado NOT IN ('cancelado', 'devuelto') THEN
      IF NEW.variante_id IS NOT NULL THEN
        UPDATE variantes_producto SET stock = stock - NEW.cantidad WHERE id = NEW.variante_id;
      END IF;
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
      IF OLD.variante_id IS NOT NULL THEN
        UPDATE variantes_producto SET stock = stock + OLD.cantidad WHERE id = OLD.variante_id;
      END IF;
      IF OLD.producto_id IS NOT NULL THEN
        UPDATE productos SET stock = stock + OLD.cantidad WHERE id = OLD.producto_id;
        PERFORM stock_local_ajustar(OLD.producto_id, v_local, OLD.cantidad);
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT estado, local_id INTO v_estado, v_local FROM pedidos WHERE id = NEW.pedido_id;
    IF OLD.producto_id IS DISTINCT FROM NEW.producto_id OR OLD.variante_id IS DISTINCT FROM NEW.variante_id THEN
      IF v_estado NOT IN ('cancelado', 'devuelto') THEN
        IF OLD.variante_id IS NOT NULL THEN
          UPDATE variantes_producto SET stock = stock + OLD.cantidad WHERE id = OLD.variante_id;
        END IF;
        IF OLD.producto_id IS NOT NULL THEN
          UPDATE productos SET stock = stock + OLD.cantidad WHERE id = OLD.producto_id;
          PERFORM stock_local_ajustar(OLD.producto_id, v_local, OLD.cantidad);
        END IF;
        
        IF NEW.variante_id IS NOT NULL THEN
          UPDATE variantes_producto SET stock = stock - NEW.cantidad WHERE id = NEW.variante_id;
        END IF;
        IF NEW.producto_id IS NOT NULL THEN
          UPDATE productos SET stock = stock - NEW.cantidad WHERE id = NEW.producto_id;
          PERFORM stock_local_ajustar(NEW.producto_id, v_local, -NEW.cantidad);
        END IF;
      END IF;
    ELSE
      IF OLD.cantidad != NEW.cantidad THEN
        IF v_estado NOT IN ('cancelado', 'devuelto') THEN
          IF NEW.variante_id IS NOT NULL THEN
            UPDATE variantes_producto SET stock = stock + OLD.cantidad - NEW.cantidad WHERE id = NEW.variante_id;
          END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.trigger_ajustar_stock_estado_pedido()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  r RECORD;
BEGIN
  IF NEW.estado IN ('cancelado', 'devuelto') AND OLD.estado NOT IN ('cancelado', 'devuelto') THEN
    FOR r IN SELECT producto_id, variante_id, SUM(cantidad) AS cant FROM items_pedido
             WHERE pedido_id = NEW.id AND (producto_id IS NOT NULL OR variante_id IS NOT NULL) GROUP BY producto_id, variante_id
    LOOP
      IF r.variante_id IS NOT NULL THEN
        UPDATE variantes_producto SET stock = stock + r.cant WHERE id = r.variante_id;
      END IF;
      IF r.producto_id IS NOT NULL THEN
        UPDATE productos SET stock = stock + r.cant WHERE id = r.producto_id;
        PERFORM stock_local_ajustar(r.producto_id, NEW.local_id, r.cant);
      END IF;
    END LOOP;
  END IF;

  IF NEW.estado NOT IN ('cancelado', 'devuelto') AND OLD.estado IN ('cancelado', 'devuelto') THEN
    FOR r IN SELECT producto_id, variante_id, SUM(cantidad) AS cant FROM items_pedido
             WHERE pedido_id = NEW.id AND (producto_id IS NOT NULL OR variante_id IS NOT NULL) GROUP BY producto_id, variante_id
    LOOP
      IF r.variante_id IS NOT NULL THEN
        UPDATE variantes_producto SET stock = stock - r.cant WHERE id = r.variante_id;
      END IF;
      IF r.producto_id IS NOT NULL THEN
        UPDATE productos SET stock = stock - r.cant WHERE id = r.producto_id;
        PERFORM stock_local_ajustar(r.producto_id, NEW.local_id, -r.cant);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;
