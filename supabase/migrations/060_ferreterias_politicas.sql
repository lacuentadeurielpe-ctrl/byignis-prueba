-- Migration 060: Columnas de políticas de negocio en ferreterias
--
-- Estas columnas son usadas por settings-2 → Avanzado → Políticas.
-- permitir_venta_sin_stock: override global (además de por-producto venta_sin_stock)
-- requiere_aprobacion_credito: bloquea venta a crédito sin aprobación explícita
-- margen_minimo_descuento: descuento mínimo aplicable (0 = sin límite)

ALTER TABLE public.ferreterias
  ADD COLUMN IF NOT EXISTS permitir_venta_sin_stock    BOOLEAN         DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requiere_aprobacion_credito BOOLEAN         DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS margen_minimo_descuento     NUMERIC(5,2)    DEFAULT 0;
