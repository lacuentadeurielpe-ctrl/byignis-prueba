-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN 076 — Completar bot_agentes_activos con los 8 agentes
--
-- Contexto: La migración 059 solo configuró 4 agentes por defecto
-- (ventas, comprobantes, upsell, crm). El registro de agentes (registry.ts)
-- define 8: los 4 anteriores + comunicaciones, agenda, pagos, inventario.
--
-- Los 4 nuevos no estaban en el default, por lo que ferreterías existentes
-- los tenían ausentes. Tras corregir message-handler.ts para mapear los 8,
-- la ausencia se interpreta ahora como "desactivado" en vez de "activo".
-- Esta migración actualiza filas existentes para evitar la regresión.
--
-- Semántica:
--   - pagos e inventario: tienen tools sin integración → se habilitan
--   - comunicaciones y agenda: todas sus tools requieren integraciones externas
--     (telegram/resend/google); se habilitan pero no harán nada hasta que
--     el tenant conecte la integración correspondiente.
-- ══════════════════════════════════════════════════════════════════

-- 1. Actualizar el default de la columna para nuevas ferreterías
ALTER TABLE ferreterias
  ALTER COLUMN bot_agentes_activos
    SET DEFAULT ARRAY['ventas','comprobantes','upsell','crm','comunicaciones','agenda','pagos','inventario']::TEXT[];

-- 2. Actualizar ferreterías existentes que tienen el array antiguo de 4 agentes
--    (o menos). Añadir los 4 nuevos sin tocar los que ya tienen configurados.
UPDATE ferreterias
SET bot_agentes_activos = ARRAY(
  SELECT DISTINCT unnest(
    COALESCE(bot_agentes_activos, ARRAY[]::TEXT[])
    ||
    ARRAY['comunicaciones','agenda','pagos','inventario']::TEXT[]
  )
  ORDER BY 1
)
WHERE bot_agentes_activos IS NOT NULL
  AND NOT (bot_agentes_activos @> ARRAY['comunicaciones','agenda','pagos','inventario']::TEXT[]);

-- 3. Poner el valor completo en filas donde la columna es NULL
UPDATE ferreterias
SET bot_agentes_activos = ARRAY['ventas','comprobantes','upsell','crm','comunicaciones','agenda','pagos','inventario']::TEXT[]
WHERE bot_agentes_activos IS NULL;
