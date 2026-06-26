-- 088_configuracion_meta.sql
-- Configuración de Meta WhatsApp Cloud API por ferretería.
-- Diseño simétrico a configuracion_ycloud para facilitar el mantenimiento.
-- Proveedor activo = Meta si tiene fila activa aquí; YCloud si tiene fila activa allá.

CREATE TABLE IF NOT EXISTS public.configuracion_meta (
  ferreteria_id          UUID        PRIMARY KEY REFERENCES public.ferreterias(id) ON DELETE CASCADE,

  -- Credenciales de la WABA del tenant (cifradas con lib/encryption)
  phone_number_id        TEXT        NOT NULL,          -- ID del número en Meta (no es el teléfono visible)
  waba_id                TEXT,                          -- WhatsApp Business Account ID (opcional, para auditoría)
  access_token_enc       TEXT        NOT NULL,          -- Permanente o de sistema, cifrado
  webhook_verify_token   TEXT        NOT NULL DEFAULT gen_random_uuid()::text,

  -- Número visible del negocio (E.164 sin +, igual que en configuracion_ycloud)
  numero_whatsapp        TEXT,

  -- Estado de la conexión
  estado_conexion        TEXT        NOT NULL DEFAULT 'pendiente'
                           CHECK (estado_conexion IN ('activo', 'error', 'pendiente', 'desconectado')),
  ultimo_mensaje_at      TIMESTAMPTZ,
  ultimo_error           TEXT,
  ultimo_error_at        TIMESTAMPTZ,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para búsqueda por phone_number_id (clave en webhook entrante)
CREATE UNIQUE INDEX IF NOT EXISTS idx_configuracion_meta_phone_number_id
  ON public.configuracion_meta (phone_number_id);

-- Índice para búsqueda por número visible (para deduplicar con YCloud)
CREATE INDEX IF NOT EXISTS idx_configuracion_meta_numero
  ON public.configuracion_meta (numero_whatsapp)
  WHERE numero_whatsapp IS NOT NULL;

-- Solo el service_role accede (admin client). Ningún tenant puede leer credenciales de otro.
ALTER TABLE public.configuracion_meta ENABLE ROW LEVEL SECURITY;

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_configuracion_meta_updated_at ON public.configuracion_meta;
CREATE TRIGGER trg_configuracion_meta_updated_at
  BEFORE UPDATE ON public.configuracion_meta
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.configuracion_meta IS
  'Credenciales Meta WhatsApp Cloud API por ferretería. Proveedor activo si estado_conexion=activo.';
COMMENT ON COLUMN public.configuracion_meta.phone_number_id IS
  'ID interno de Meta para el número (metadata.phone_number_id en el webhook).';
COMMENT ON COLUMN public.configuracion_meta.webhook_verify_token IS
  'Token que Meta usa para verificar el webhook al configurarlo (GET hub.verify_token).';
