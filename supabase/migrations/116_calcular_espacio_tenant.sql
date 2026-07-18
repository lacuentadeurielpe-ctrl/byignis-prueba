-- Función para estimar el espacio ocupado por un tenant en Supabase (KB)
-- Basado en un algoritmo de peso volumétrico promedio por tipo de registro
CREATE OR REPLACE FUNCTION calcular_espacio_tenant_kb(p_ferreteria_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_pedidos INT;
  v_productos INT;
  v_clientes INT;
  v_conversaciones INT;
  v_mensajes INT;
  v_comprobantes INT;
  total_kb NUMERIC;
BEGIN
  -- Contar registros principales
  SELECT count(*) INTO v_pedidos FROM pedidos WHERE ferreteria_id = p_ferreteria_id;
  SELECT count(*) INTO v_productos FROM productos WHERE ferreteria_id = p_ferreteria_id;
  SELECT count(*) INTO v_clientes FROM clientes WHERE ferreteria_id = p_ferreteria_id;
  SELECT count(*) INTO v_conversaciones FROM conversaciones WHERE ferreteria_id = p_ferreteria_id;
  
  -- Para mensajes, cruzamos con conversaciones
  SELECT count(m.*) INTO v_mensajes 
  FROM mensajes m 
  JOIN conversaciones c ON m.conversacion_id = c.id 
  WHERE c.ferreteria_id = p_ferreteria_id;
  
  SELECT count(*) INTO v_comprobantes FROM comprobantes WHERE ferreteria_id = p_ferreteria_id;
  
  -- Estimaciones volumétricas en KB por fila (promedios para JSONB/texto)
  -- Pedidos: ~2KB (incluye items JSONB)
  -- Productos: ~1.5KB
  -- Clientes: ~0.5KB
  -- Conversaciones: ~1KB
  -- Mensajes: ~0.5KB (texto, metadatos WA)
  -- Comprobantes: ~3KB (xml, json SUNAT, etc)
  
  total_kb := (v_pedidos * 2.0) 
            + (v_productos * 1.5) 
            + (v_clientes * 0.5) 
            + (v_conversaciones * 1.0) 
            + (v_mensajes * 0.5) 
            + (v_comprobantes * 3.0);
            
  -- Sumar un base fijo de metadatos del tenant (150KB)
  total_kb := total_kb + 150.0;
  
  RETURN ROUND(total_kb, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
