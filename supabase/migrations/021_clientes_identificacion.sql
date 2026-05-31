-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN 021 — Identificación de clientes mejorada
--
-- Agrega: dni_ruc, tipo, alias, email, telefono_secundario,
--         notas_internas, tags, direccion_habitual
--
-- Lógica:
--   - Teléfono sigue siendo el ID principal (bot lo captura automático)
--   - DNI/RUC es el ID fiscal (para SUNAT)
--   - Al menos uno de los dos debe estar presente (excepto tipo 'anonimo')
--   - Aislamiento multi-tenancy: ferreteria_id en todo
-- ══════════════════════════════════════════════════════════════════

-- 1. Nuevas columnas de identificación y perfil
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS dni_ruc             TEXT,
  ADD COLUMN IF NOT EXISTS tipo                TEXT NOT NULL DEFAULT 'persona'
    CHECK (tipo IN ('persona', 'empresa', 'anonimo')),
  ADD COLUMN IF NOT EXISTS alias               TEXT,
  ADD COLUMN IF NOT EXISTS email               TEXT,
  ADD COLUMN IF NOT EXISTS telefono_secundario TEXT,
  ADD COLUMN IF NOT EXISTS direccion_habitual  TEXT,
  ADD COLUMN IF NOT EXISTS tags                TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notas_internas      TEXT;

-- 2. Comentarios descriptivos
COMMENT ON COLUMN clientes.dni_ruc IS
  'DNI (8 dígitos) para personas naturales, RUC (11 dígitos) para empresas. '
  'Se usa para pre-llenar boletas/facturas SUNAT. '
  'AISLADO: solo visible por ferreteria_id del tenant.';

COMMENT ON COLUMN clientes.tipo IS
  'persona: cliente natural con nombre y/o teléfono. '
  'empresa: persona jurídica, el identificador principal puede ser RUC. '
  'anonimo: venta en mostrador sin datos — sin crédito ni delivery.';

COMMENT ON COLUMN clientes.alias IS
  'Apodo interno del vendedor ("el plomero de San Isidro"). '
  'Ayuda a reconocer al cliente sin necesidad de teléfono.';

COMMENT ON COLUMN clientes.tags IS
  'Etiquetas de segmentación: ["vip", "mayorista", "constructor", ...]. '
  'Útil para filtros y marketing futuro.';

COMMENT ON COLUMN clientes.notas_internas IS
  'Notas privadas del vendedor sobre este cliente. '
  'No se muestra al cliente ni al bot por defecto.';

-- 3. Permitir telefono NULL para clientes tipo empresa (cuyo ID principal es RUC)
--    El constraint UNIQUE previo puede quedar como NULLS NOT DISTINCT
--    para que dos NULL no colisionen (PostgreSQL 15+)
--    En versiones anteriores usamos un índice parcial.

-- Intentar con NULLS NOT DISTINCT (Postgres 15+, Supabase lo soporta)
ALTER TABLE clientes
  DROP CONSTRAINT IF EXISTS clientes_ferreteria_id_telefono_key;

-- Índice único parcial para teléfonos no-nulos (compatible con cualquier versión de PG)
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_telefono
  ON clientes (ferreteria_id, telefono)
  WHERE telefono IS NOT NULL;

-- Índice único parcial para DNI/RUC no-nulo por tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_dni_ruc
  ON clientes (ferreteria_id, dni_ruc)
  WHERE dni_ruc IS NOT NULL;

-- 4. Constraint: al menos telefono o dni_ruc debe estar presente
--    (salvo tipo='anonimo' que puede no tener ninguno)
ALTER TABLE clientes
  ADD CONSTRAINT chk_cliente_tiene_identificador
    CHECK (
      tipo = 'anonimo'
      OR telefono IS NOT NULL
      OR dni_ruc IS NOT NULL
    );

-- 5. Índices de búsqueda
CREATE INDEX IF NOT EXISTS idx_clientes_tipo    ON clientes (ferreteria_id, tipo);
CREATE INDEX IF NOT EXISTS idx_clientes_dni_ruc ON clientes (ferreteria_id, dni_ruc) WHERE dni_ruc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_alias   ON clientes (ferreteria_id, alias)   WHERE alias IS NOT NULL;

-- 6. Relajar NOT NULL en pedidos.telefono_cliente
--    (pedidos anónimos pueden no tener teléfono)
ALTER TABLE pedidos
  ALTER COLUMN telefono_cliente DROP NOT NULL;
