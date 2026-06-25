-- 082_tarifas_ia_precio_cobro.sql
-- Agrega precio de venta a cada API de IA (tratarlas como productos del catálogo)
-- precio_cobro = lo que cobramos al tenant; precio_entrada/salida = lo que pagamos al proveedor

ALTER TABLE tarifas_ia
  ADD COLUMN IF NOT EXISTS precio_cobro_usd_por_1k NUMERIC(12,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precio_cobro_pen_por_1k NUMERIC(12,8) NOT NULL DEFAULT 0;

-- Seed: markup ~5x sobre costo de entrada para cada modelo conocido
UPDATE tarifas_ia SET
  precio_cobro_usd_por_1k = CASE modelo
    WHEN 'deepseek-chat'               THEN 0.00070000
    WHEN 'gpt-4o-mini'                THEN 0.00075000
    WHEN 'claude-3-5-sonnet-20241022'  THEN 0.01500000
    WHEN 'claude-sonnet-4-6'           THEN 0.01500000
    WHEN 'gpt-4o'                      THEN 0.02500000
    WHEN 'gemini-2.5-flash'            THEN 0.00075000
    WHEN 'whisper-1'                   THEN 0.03000000
    ELSE precio_entrada_por_1k * 5
  END,
  precio_cobro_pen_por_1k = CASE modelo
    WHEN 'deepseek-chat'               THEN 0.00262500
    WHEN 'gpt-4o-mini'                THEN 0.00281250
    WHEN 'claude-3-5-sonnet-20241022'  THEN 0.05625000
    WHEN 'claude-sonnet-4-6'           THEN 0.05625000
    WHEN 'gpt-4o'                      THEN 0.09375000
    WHEN 'gemini-2.5-flash'            THEN 0.00281250
    WHEN 'whisper-1'                   THEN 0.11250000
    ELSE precio_entrada_por_1k * 5 * 3.75
  END;
