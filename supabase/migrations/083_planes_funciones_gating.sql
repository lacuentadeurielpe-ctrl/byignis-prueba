-- 083_planes_funciones_gating.sql
-- Plan Gratuito, Plan Vitalicio (invisible), tabla de funciones por plan

-- ── 1. Columnas nuevas en planes ────────────────────────────────────────────
ALTER TABLE planes
  ADD COLUMN IF NOT EXISTS es_publico          BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS creditos_ilimitados BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Plan Gratuito ────────────────────────────────────────────────────────
INSERT INTO planes (nombre, creditos_mes, precio_mensual, precio_exceso, activo, es_publico, creditos_ilimitados)
VALUES ('Gratuito', 200, 0.00, 0.08, true, true, false)
ON CONFLICT DO NOTHING;

-- ── 3. Plan Vitalicio — invisible para tenants, solo asignable por superadmin
INSERT INTO planes (nombre, creditos_mes, precio_mensual, precio_exceso, activo, es_publico, creditos_ilimitados)
VALUES ('Vitalicio', 999999, 0.00, 0.00, true, false, true)
ON CONFLICT DO NOTHING;

-- ── 4. Catálogo de funciones de la plataforma ────────────────────────────────
CREATE TABLE IF NOT EXISTS funciones_plataforma (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  clave       TEXT    NOT NULL UNIQUE,
  nombre      TEXT    NOT NULL,
  modulo      TEXT    NOT NULL CHECK (modulo IN ('bot','pos','inventario','delivery','crm','ia','reportes','integraciones','sistema')),
  descripcion TEXT,
  orden       INTEGER NOT NULL DEFAULT 0
);

-- ── 5. Tabla de asignación plan → funciones ──────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_funciones (
  plan_id    UUID    NOT NULL REFERENCES planes(id) ON DELETE CASCADE,
  funcion_id UUID    NOT NULL REFERENCES funciones_plataforma(id) ON DELETE CASCADE,
  habilitada BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (plan_id, funcion_id)
);

-- ── 6. Seed de funciones ────────────────────────────────────────────────────
INSERT INTO funciones_plataforma (clave, nombre, modulo, descripcion, orden) VALUES
  ('bot_respuestas',         'Bot: respuestas básicas',              'bot',           'Saludos, consultas simples y FAQ con DeepSeek', 10),
  ('bot_cotizaciones',       'Bot: cotizaciones con IA',             'bot',           'Generar cotizaciones detalladas desde WhatsApp', 20),
  ('bot_pedidos',            'Bot: pedidos desde WhatsApp',          'bot',           'Crear y confirmar pedidos por conversación', 30),
  ('bot_audio',              'Bot: transcripción de audio (Whisper)','bot',           'Procesar mensajes de voz del cliente', 40),
  ('bot_imagenes',           'Bot: análisis de imágenes (Vision)',   'bot',           'Leer listas de precios, fotos de productos', 50),
  ('bot_multiagente',        'Bot: orquestador Claude',              'bot',           'Casos complejos y negociación con Claude Sonnet', 60),
  ('pos_basico',             'POS: ventas manuales',                 'pos',           'Punto de venta básico sin IA', 10),
  ('pos_ia',                 'POS: sugerencias con IA',              'pos',           'Recomendaciones de productos en caja con IA', 20),
  ('inventario_basico',      'Inventario: catálogo y stock',         'inventario',    'Gestión de productos, precios y stock', 10),
  ('inventario_alertas_ia',  'Inventario: análisis y alertas IA',    'inventario',    'Predicción de quiebre de stock con IA', 20),
  ('delivery_basico',        'Delivery: portal repartidor',          'delivery',      'Asignación y seguimiento básico de entregas', 10),
  ('delivery_seguimiento',   'Delivery: seguimiento en tiempo real', 'delivery',      'Tracking, notificaciones y agenda de repartidor', 20),
  ('crm_basico',             'CRM: historial de clientes',           'crm',           'Registro, búsqueda y notas de clientes', 10),
  ('crm_ia_analisis',        'CRM: análisis periódico con IA',       'crm',           'Estudio automático de comportamiento y frecuencia', 20),
  ('crm_ia_perfiles',        'CRM: perfiles predictivos IA',         'crm',           'Segmentación, predicción de compra y alertas VIP', 30),
  ('asistente_ia',           'Dashboard: asistente IA',              'ia',            'Asistente de configuración y consultas en el panel', 10),
  ('reportes_basicos',       'Reportes: ventas y estadísticas',      'reportes',      'Dashboard de ventas, inventario y clientes', 10),
  ('reportes_ia',            'Reportes: generados con IA',           'reportes',      'Análisis narrativos, tendencias y recomendaciones IA', 20),
  ('integraciones_telegram', 'Integración: Telegram',                'integraciones', 'Canal de ventas adicional por Telegram', 10),
  ('integraciones_email',    'Integración: Email marketing',         'integraciones', 'Campañas, notificaciones y facturas por email', 20),
  ('contabilidad',           'Contabilidad: facturación SUNAT',      'sistema',       'Boletas, facturas y comprobantes electrónicos', 10),
  ('multiusuario',           'Sistema: multi-usuario y roles',       'sistema',       'Vendedores, repartidores y permisos por rol', 20)
ON CONFLICT (clave) DO NOTHING;

-- ── 7. Asignación plan → funciones ──────────────────────────────────────────

-- GRATUITO: solo funciones sin IA avanzada
INSERT INTO plan_funciones (plan_id, funcion_id)
SELECT p.id, f.id
FROM planes p, funciones_plataforma f
WHERE p.nombre = 'Gratuito'
  AND f.clave IN (
    'bot_respuestas', 'pos_basico', 'inventario_basico',
    'crm_basico', 'reportes_basicos', 'contabilidad'
  );

-- ESENCIAL: bot completo excepto Claude, delivery, asistente IA, sin CRM IA ni integraciones
INSERT INTO plan_funciones (plan_id, funcion_id)
SELECT p.id, f.id
FROM planes p, funciones_plataforma f
WHERE p.nombre = 'Esencial'
  AND f.clave IN (
    'bot_respuestas', 'bot_cotizaciones', 'bot_pedidos', 'bot_audio', 'bot_imagenes',
    'pos_basico', 'inventario_basico',
    'delivery_basico', 'delivery_seguimiento',
    'crm_basico', 'asistente_ia',
    'reportes_basicos', 'contabilidad', 'multiusuario'
  );

-- ACTIVO: todo habilitado
INSERT INTO plan_funciones (plan_id, funcion_id)
SELECT p.id, f.id
FROM planes p, funciones_plataforma f
WHERE p.nombre = 'Activo';

-- VITALICIO: todo habilitado
INSERT INTO plan_funciones (plan_id, funcion_id)
SELECT p.id, f.id
FROM planes p, funciones_plataforma f
WHERE p.nombre = 'Vitalicio';
