-- Migración: Solución de unicidad y secuencia de pedidos
-- 1. Modificar restricción de unicidad (pasar de global a compuesta por ferretería)
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_numero_pedido_key;
ALTER TABLE public.pedidos ADD CONSTRAINT uq_pedidos_numero_pedido UNIQUE (ferreteria_id, numero_pedido);

-- 2. Crear tabla de secuencias
CREATE TABLE IF NOT EXISTS public.secuencias_pedido (
  ferreteria_id UUID PRIMARY KEY REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

-- 3. Inicializar secuencias con el máximo número existente por tenant
INSERT INTO public.secuencias_pedido (ferreteria_id, ultimo_numero)
SELECT 
  ferreteria_id, 
  COALESCE(MAX(NULLIF(regexp_replace(numero_pedido, '^.*-', ''), '')::integer), 0)
FROM public.pedidos
GROUP BY ferreteria_id
ON CONFLICT (ferreteria_id) DO UPDATE
SET ultimo_numero = GREATEST(secuencias_pedido.ultimo_numero, EXCLUDED.ultimo_numero);

-- 4. Reemplazar la función generar_numero_pedido
CREATE OR REPLACE FUNCTION generar_numero_pedido(p_ferreteria_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_contador INTEGER;
  v_prefijo TEXT;
BEGIN
  -- Obtener prefijo (primeras 3 letras, mayúsculas)
  SELECT UPPER(LEFT(REGEXP_REPLACE(nombre, '[^a-zA-Z]', '', 'g'), 3))
  INTO v_prefijo
  FROM ferreterias
  WHERE id = p_ferreteria_id;
  
  IF v_prefijo IS NULL OR v_prefijo = '' THEN
    v_prefijo := 'PED';
  END IF;

  -- Incrementar de forma segura la secuencia del tenant
  INSERT INTO secuencias_pedido (ferreteria_id, ultimo_numero)
  VALUES (p_ferreteria_id, 1)
  ON CONFLICT (ferreteria_id)
  DO UPDATE SET ultimo_numero = secuencias_pedido.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_contador;

  RETURN v_prefijo || '-' || LPAD(v_contador::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
