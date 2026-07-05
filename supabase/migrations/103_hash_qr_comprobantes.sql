-- 103: Columnas agnósticas para el hash CPE y la cadena del QR del comprobante.
-- Antes vivían en nubefact_hash / nubefact_qr_cadena (solo las llenaba Nubefact,
-- así que los PDF de SUNAT Directo salían sin QR ni hash). El adapter SUNAT
-- ahora escribe aquí: hash desde Lycet, QR construido según RM 155-2017.
-- Aditiva a propósito: el drop de las columnas nubefact_* va en la 104,
-- después de que el código nuevo esté desplegado (patrón expand/contract).

ALTER TABLE comprobantes
  ADD COLUMN IF NOT EXISTS hash_cpe  TEXT,
  ADD COLUMN IF NOT EXISTS qr_cadena TEXT;
