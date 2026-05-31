-- Migración 026: Sistema Robusto de Inventarios mediante Triggers
-- 1. Agregar el estado 'devuelto' a pedidos
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check CHECK (estado IN ('programado', 'pendiente', 'confirmado', 'en_preparacion', 'enviado', 'entregado', 'cancelado', 'devuelto'));

-- 2. Función Trigger principal para Items Pedido
CREATE OR REPLACE FUNCTION trigger_ajustar_stock_items_pedido()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT: Restar stock si el pedido no está cancelado/devuelto
  IF TG_OP = 'INSERT' THEN
    IF (SELECT estado FROM pedidos WHERE id = NEW.pedido_id) NOT IN ('cancelado', 'devuelto') THEN
      UPDATE productos SET stock = stock - NEW.cantidad WHERE id = NEW.producto_id;
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE: Sumar stock si el pedido no estaba cancelado/devuelto
  IF TG_OP = 'DELETE' THEN
    IF (SELECT estado FROM pedidos WHERE id = OLD.pedido_id) NOT IN ('cancelado', 'devuelto') THEN
      UPDATE productos SET stock = stock + OLD.cantidad WHERE id = OLD.producto_id;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: Ajustar la diferencia de stock si cambia la cantidad (y el pedido es válido)
  IF TG_OP = 'UPDATE' THEN
    -- Si cambió el producto entero (raro, pero posible)
    IF OLD.producto_id != NEW.producto_id THEN
      IF (SELECT estado FROM pedidos WHERE id = NEW.pedido_id) NOT IN ('cancelado', 'devuelto') THEN
        UPDATE productos SET stock = stock + OLD.cantidad WHERE id = OLD.producto_id;
        UPDATE productos SET stock = stock - NEW.cantidad WHERE id = NEW.producto_id;
      END IF;
    ELSE
      -- Si solo cambió la cantidad
      IF OLD.cantidad != NEW.cantidad THEN
        IF (SELECT estado FROM pedidos WHERE id = NEW.pedido_id) NOT IN ('cancelado', 'devuelto') THEN
          UPDATE productos SET stock = stock + OLD.cantidad - NEW.cantidad WHERE id = NEW.producto_id;
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Función Trigger para Cambios de Estado del Pedido
CREATE OR REPLACE FUNCTION trigger_ajustar_stock_estado_pedido()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el estado cambia a cancelado/devuelto (desde un estado activo) -> DEVOLVER STOCK
  IF NEW.estado IN ('cancelado', 'devuelto') AND OLD.estado NOT IN ('cancelado', 'devuelto') THEN
    UPDATE productos
    SET stock = stock + (
      SELECT COALESCE(SUM(cantidad), 0)
      FROM items_pedido
      WHERE pedido_id = NEW.id AND producto_id = productos.id
    )
    WHERE id IN (
      SELECT producto_id FROM items_pedido WHERE pedido_id = NEW.id
    );
  END IF;

  -- Si el estado cambia a activo (desde cancelado/devuelto) -> RESTAR STOCK
  IF NEW.estado NOT IN ('cancelado', 'devuelto') AND OLD.estado IN ('cancelado', 'devuelto') THEN
    UPDATE productos
    SET stock = stock - (
      SELECT COALESCE(SUM(cantidad), 0)
      FROM items_pedido
      WHERE pedido_id = NEW.id AND producto_id = productos.id
    )
    WHERE id IN (
      SELECT producto_id FROM items_pedido WHERE pedido_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Asociar Triggers a las tablas
DROP TRIGGER IF EXISTS trigger_items_pedido_stock ON items_pedido;
CREATE TRIGGER trigger_items_pedido_stock
AFTER INSERT OR UPDATE OR DELETE ON items_pedido
FOR EACH ROW EXECUTE FUNCTION trigger_ajustar_stock_items_pedido();

DROP TRIGGER IF EXISTS trigger_pedidos_stock ON pedidos;
CREATE TRIGGER trigger_pedidos_stock
AFTER UPDATE OF estado ON pedidos
FOR EACH ROW EXECUTE FUNCTION trigger_ajustar_stock_estado_pedido();
