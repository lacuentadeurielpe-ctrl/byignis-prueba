-- 104: Limpieza final — elimina las columnas de Nubefact.
-- Se aplica DESPUÉS de desplegar el código que ya no las lee (patrón
-- expand/contract con la 103). Verificado antes de escribir esta migración:
-- 0 comprobantes con nubefact_id y 0 ferreterías con token guardado.

ALTER TABLE ferreterias
  DROP COLUMN IF EXISTS nubefact_token_enc,
  DROP COLUMN IF EXISTS nubefact_ruta,
  DROP COLUMN IF EXISTS nubefact_modo;

ALTER TABLE comprobantes
  DROP COLUMN IF EXISTS nubefact_id,
  DROP COLUMN IF EXISTS nubefact_hash,
  DROP COLUMN IF EXISTS nubefact_qr_cadena;
