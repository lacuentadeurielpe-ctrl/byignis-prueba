-- Nombre visible del remitente para emails de Resend
-- Permite "Ferretería El Martillo <cotizaciones@ferreteria.com>" en lugar de solo el email
ALTER TABLE public.ferreterias
  ADD COLUMN IF NOT EXISTS resend_from_name TEXT;
