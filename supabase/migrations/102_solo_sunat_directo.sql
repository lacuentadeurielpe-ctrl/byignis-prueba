-- 102: SUNAT Directo pasa a ser el único proveedor de facturación.
-- Nubefact se elimina del sistema: ninguna ferretería lo usó en producción
-- (0 comprobantes con nubefact_id, 0 tokens guardados), así que solo hay que
-- migrar el valor del enum y el default. El drop de columnas nubefact_* va en
-- la migración 103, cuando el código ya no las lea.

UPDATE ferreterias
SET proveedor_facturacion = 'sunat_directo'
WHERE proveedor_facturacion = 'nubefact' OR proveedor_facturacion IS NULL;

ALTER TABLE ferreterias
  ALTER COLUMN proveedor_facturacion SET DEFAULT 'sunat_directo';
