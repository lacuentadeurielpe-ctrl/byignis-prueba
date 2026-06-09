-- Función para los KPIs del dashboard principal.
-- Reemplaza la llamada rpc() que faltaba en producción.
-- Esta migración puede aplicarse al proyecto Supabase cuando se tenga acceso CLI.

CREATE OR REPLACE FUNCTION dashboard_kpi_rango(
  f_id      UUID,
  p_inicio  TIMESTAMPTZ,
  p_fin     TIMESTAMPTZ
)
RETURNS TABLE(
  pedidos_n      INTEGER,
  entregados_n   INTEGER,
  ingresos_total NUMERIC,
  ganancia_total NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  WITH pedidos_rango AS (
    SELECT p.id, p.estado, p.total
    FROM pedidos p
    WHERE p.ferreteria_id = f_id
      AND p.estado NOT IN ('pendiente', 'cancelado', 'programado')
      AND p.created_at >= p_inicio
      AND p.created_at < p_fin
  ),
  cogs AS (
    SELECT
      ip.pedido_id,
      SUM(ip.cantidad * COALESCE(prod.precio_compra, 0)) AS total_costo
    FROM items_pedido ip
    JOIN pedidos_rango pr ON pr.id = ip.pedido_id
    LEFT JOIN productos prod ON prod.id = ip.producto_id
    GROUP BY ip.pedido_id
  )
  SELECT
    COUNT(pr.id)::INTEGER                                           AS pedidos_n,
    COUNT(pr.id) FILTER (WHERE pr.estado = 'entregado')::INTEGER   AS entregados_n,
    COALESCE(SUM(pr.total), 0)                                      AS ingresos_total,
    COALESCE(SUM(pr.total) - SUM(COALESCE(c.total_costo, 0)), 0)   AS ganancia_total
  FROM pedidos_rango pr
  LEFT JOIN cogs c ON c.pedido_id = pr.id;
$$;

GRANT EXECUTE ON FUNCTION dashboard_kpi_rango(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO anon, authenticated;
