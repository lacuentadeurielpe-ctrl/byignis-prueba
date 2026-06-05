-- Migración 032: Sistema de Código Interno de Producto
-- 1. Crear tabla de secuencias por ferretería
CREATE TABLE IF NOT EXISTS public.secuencias_codigo_producto (
  ferreteria_id UUID PRIMARY KEY REFERENCES public.ferreterias(id) ON DELETE CASCADE,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

-- Habilitar RLS en la tabla de secuencias
ALTER TABLE public.secuencias_codigo_producto ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para secuencias (solo lectura por dueños/miembros, aunque las funciones SECURITY DEFINER se ejecutan con privilegios elevados)
CREATE POLICY "Permitir lectura de secuencias a miembros del tenant"
  ON public.secuencias_codigo_producto
  FOR SELECT
  USING (ferreteria_id = (SELECT mi_ferreteria_id()));

-- 2. Crear la función para generar el código interno
CREATE OR REPLACE FUNCTION public.generar_codigo_interno(p_ferreteria_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_contador INTEGER;
  v_prefijo TEXT;
BEGIN
  -- Obtener prefijo (primeras 3 letras, mayúsculas, removiendo caracteres no alfabéticos)
  SELECT UPPER(LEFT(REGEXP_REPLACE(nombre, '[^a-zA-Z]', '', 'g'), 3))
  INTO v_prefijo
  FROM public.ferreterias
  WHERE id = p_ferreteria_id;
  
  IF v_prefijo IS NULL OR v_prefijo = '' THEN
    v_prefijo := 'PRO';
  ELSIF length(v_prefijo) < 3 THEN
    v_prefijo := rpad(v_prefijo, 3, 'X');
  END IF;

  -- Incrementar de forma segura la secuencia de códigos del tenant
  INSERT INTO public.secuencias_codigo_producto (ferreteria_id, ultimo_numero)
  VALUES (p_ferreteria_id, 1)
  ON CONFLICT (ferreteria_id)
  DO UPDATE SET ultimo_numero = public.secuencias_codigo_producto.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_contador;

  RETURN v_prefijo || '-' || LPAD(v_contador::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Añadir la columna a la tabla de productos
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS codigo_interno TEXT;

-- 4. Inicializar códigos internos de productos existentes
DO $$
DECLARE
  r RECORD;
  v_cod TEXT;
BEGIN
  FOR r IN 
    SELECT id, ferreteria_id 
    FROM public.productos 
    WHERE codigo_interno IS NULL 
    ORDER BY created_at ASC 
  LOOP
    v_cod := public.generar_codigo_interno(r.ferreteria_id);
    UPDATE public.productos SET codigo_interno = v_cod WHERE id = r.id;
  END LOOP;
END;
$$;

-- 5. Hacer la columna NOT NULL y agregar restricción de unicidad compuesta por tenant
ALTER TABLE public.productos ALTER COLUMN codigo_interno SET NOT NULL;
ALTER TABLE public.productos DROP CONSTRAINT IF EXISTS uq_productos_codigo_interno_por_ferreteria;
ALTER TABLE public.productos ADD CONSTRAINT uq_productos_codigo_interno_por_ferreteria UNIQUE (ferreteria_id, codigo_interno);

-- 6. Crear la función del trigger para asignar código interno antes de insertar
CREATE OR REPLACE FUNCTION public.trigger_set_codigo_interno()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo_interno IS NULL THEN
    NEW.codigo_interno := public.generar_codigo_interno(NEW.ferreteria_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Crear el trigger en la tabla productos
DROP TRIGGER IF EXISTS trigger_productos_codigo_interno ON public.productos;
CREATE TRIGGER trigger_productos_codigo_interno
BEFORE INSERT ON public.productos
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_codigo_interno();
