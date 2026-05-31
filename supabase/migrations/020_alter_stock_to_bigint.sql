-- Migración: Alterar columnas de stock y cantidad de INTEGER a BIGINT para evitar desbordamiento (out of range)
ALTER TABLE public.productos ALTER COLUMN stock TYPE bigint;
ALTER TABLE public.productos ALTER COLUMN stock_minimo TYPE bigint;
ALTER TABLE public.productos ALTER COLUMN umbral_negociacion_cantidad TYPE bigint;

ALTER TABLE public.items_pedido ALTER COLUMN cantidad TYPE bigint;
ALTER TABLE public.items_cotizacion ALTER COLUMN cantidad TYPE bigint;

ALTER TABLE public.reglas_descuento ALTER COLUMN cantidad_min TYPE bigint;
ALTER TABLE public.reglas_descuento ALTER COLUMN cantidad_max TYPE bigint;
