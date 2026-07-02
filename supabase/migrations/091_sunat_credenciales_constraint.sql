-- Migración 091: añadir UNIQUE CONSTRAINT explícita en sunat_credenciales.ferreteria_id
-- PostgREST requiere UNIQUE CONSTRAINT (no solo UNIQUE INDEX) para que upsert onConflict funcione.
-- La 090 solo creó un UNIQUE INDEX; esto lo convierte en constraint real.
ALTER TABLE sunat_credenciales
  DROP CONSTRAINT IF EXISTS sunat_credenciales_ferreteria_unique;

ALTER TABLE sunat_credenciales
  ADD CONSTRAINT sunat_credenciales_ferreteria_unique UNIQUE (ferreteria_id);
