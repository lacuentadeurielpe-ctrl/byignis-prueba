-- Migración 027: Corrección de manejo de NULLs en Triggers de Inventario
CREATE OR REPLACE FUNCTION trigger_ajustar_stock_items_pedido()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT: Restar stock si el pedido no está cancelado/devuelto
  IF TG_OP = 'INSERT' THEN
    IF (SELECT estado FROM pedidos WHERE id = NEW.pedido_id) NOT IN ('cancelado', 'devuelto') THEN
      -- Evitar fallos si producto_id es NULL (ej. productos manuales)
      IF NEW.producto_id IS NOT NULL THEN
        UPDATE productos SET stock = stock - NEW.cantidad WHERE id = NEW.producto_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE: Sumar stock si el pedido no estaba cancelado/devuelto
  IF TG_OP = 'DELETE' THEN
    IF (SELECT estado FROM pedidos WHERE id = OLD.pedido_id) NOT IN ('cancelado', 'devuelto') THEN
      IF OLD.producto_id IS NOT NULL THEN
        UPDATE productos SET stock = stock + OLD.cantidad WHERE id = OLD.producto_id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: Ajustar la diferencia de stock si cambia la cantidad (y el pedido es válido)
  IF TG_OP = 'UPDATE' THEN
    -- Uso de IS DISTINCT FROM porque != falla si alguno es NULL
    IF OLD.producto_id IS DISTINCT FROM NEW.producto_id THEN
      IF (SELECT estado FROM pedidos WHERE id = NEW.pedido_id) NOT IN ('cancelado', 'devuelto') THEN
        IF OLD.producto_id IS NOT NULL THEN
          UPDATE productos SET stock = stock + OLD.cantidad WHERE id = OLD.producto_id;
        END IF;
        IF NEW.producto_id IS NOT NULL THEN
          UPDATE productos SET stock = stock - NEW.cantidad WHERE id = NEW.producto_id;
        END IF;
      END IF;
    ELSE
      -- Si es el mismo producto (o ambos NULL), verificamos la cantidad
      IF OLD.cantidad != NEW.cantidad THEN
        IF (SELECT estado FROM pedidos WHERE id = NEW.pedido_id) NOT IN ('cancelado', 'devuelto') THEN
          IF NEW.producto_id IS NOT NULL THEN
            UPDATE productos SET stock = stock + OLD.cantidad - NEW.cantidad WHERE id = NEW.producto_id;
          END IF;
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
