-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN 096 — Certificado en formato PEM + vencimiento
-- Lycet (motor SUNAT nuevo) consume el certificado en PEM (cert + clave privada).
-- Guardamos el PEM cifrado (además del PFX original) y la fecha de vencimiento
-- del certificado para avisar al negocio antes de que expire.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE sunat_credenciales
  ADD COLUMN IF NOT EXISTS cert_pem_enc  TEXT,          -- PEM (cert+key) cifrado AES-256-GCM, para Lycet
  ADD COLUMN IF NOT EXISTS cert_vence_at TIMESTAMPTZ;   -- vencimiento del certificado digital
