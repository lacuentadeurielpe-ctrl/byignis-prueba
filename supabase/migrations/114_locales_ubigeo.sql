-- Migration to add ubigeo and location fields to locales_ferreteria
ALTER TABLE locales_ferreteria
ADD COLUMN IF NOT EXISTS ubigeo text,
ADD COLUMN IF NOT EXISTS departamento text,
ADD COLUMN IF NOT EXISTS provincia text,
ADD COLUMN IF NOT EXISTS distrito text;
