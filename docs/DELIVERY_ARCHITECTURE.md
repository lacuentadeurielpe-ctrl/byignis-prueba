# 🚚 Arquitectura de Entregas/Delivery

## Overview

El nuevo sistema de entregas está completamente refactorizado y modularizado para manejar el flujo completo de delivery desde cotización hasta entrega confirmada.

## 📋 Flujo de Delivery

```
1. COTIZACIÓN
   └─ Cliente solicita entrega (modalidad: 'delivery', zona_id, dirección)
      └─ Cotización almacena: modalidad, zona_delivery_id, direccion_entrega

2. CONVERSIÓN A PEDIDO
   └─ Pedido heredan: modalidad='delivery', zona_delivery_id, direccion_entrega
      └─ Trigger automático crea registro en tabla `entregas`

3. CREACIÓN DE ENTREGA (automático)
   └─ Se crea registro en `entregas` con estado='asignado'
      └─ Pendiente de asignar repartidor

4. ASIGNACIÓN DE REPARTIDOR
   └─ Gerente/admin asigna repartidor + vehículo
      └─ PUT /api/entregas/[id]/asignar

5. SALIDA (En camino)
   └─ Repartidor marca como "salió"
      └─ PATCH /api/entregas/[id]/en-camino
         └─ Timestamp: salio_at = NOW()

6. ENTREGA COMPLETADA
   └─ Repartidor registra entrega con firma/fotos
      └─ PATCH /api/entregas/[id]/completar
         └─ Pedido actualiza a estado='entregado'
         └─ Duracion_real_min se calcula automáticamente
```

## 🗄️ Tablas Principales

### `entregas`
Orquesta todo el flujo de delivery.

```sql
id                  UUID PRIMARY KEY
ferreteria_id       UUID (multi-tenant)
pedido_id           UUID (FK → pedidos, UNIQUE)
zona_delivery_id    UUID (FK → zonas_delivery)
repartidor_id       UUID (FK → repartidores, nullable)
vehiculo_id         UUID (FK → vehiculos_delivery, nullable)
estado              TEXT ('asignado' | 'en_camino' | 'entregado' | 'rechazado' | 'devuelto' | 'cancelado')
asignado_at         TIMESTAMPTZ
salio_at            TIMESTAMPTZ (set by trigger cuando estado='en_camino')
llego_at            TIMESTAMPTZ (set by trigger cuando estado='entregado')
direccion_entrega   TEXT
instrucciones       TEXT
gps_ultima_lat      DOUBLE PRECISION
gps_ultima_lng      DOUBLE PRECISION
gps_actualizado_at  TIMESTAMPTZ
distancia_km        NUMERIC(8,2)
duracion_estimada_min INTEGER
duracion_real_min   INTEGER (calculado: llego_at - salio_at)
comprobante_fotos   TEXT[] (URLs)
firma_cliente_url   TEXT (URL)
nota_entrega        TEXT
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

**RLS Policy**: Acceso restringido a usuario's ferretería (`ferreteria_id = mi_ferreteria_id()`)

### `vehiculos_delivery`
Registro de vehículos para entregas.

```sql
id              UUID PRIMARY KEY
ferreteria_id   UUID (FK → ferreterias)
tipo            TEXT ('moto' | 'auto' | 'camioneta' | etc)
placa           TEXT
repartidor_id   UUID (FK → repartidores, opcional)
activo          BOOLEAN DEFAULT TRUE
```

### Cambios en `pedidos`
Se agregan campos para delivery:

```sql
modalidad           TEXT ('delivery' | 'recojo')
zona_delivery_id    UUID (FK → zonas_delivery)
direccion_entrega   TEXT
```

### Cambios en `cotizaciones`
Se agregan campos para capturar preferencia:

```sql
modalidad              TEXT ('delivery' | 'recojo')
zona_delivery_id       UUID
direccion_entrega      TEXT
es_conversion_directa  BOOLEAN (true si se convirtió sin pasar por aprobación)
```

## 🔧 APIs

### Listar entregas
```
GET /api/entregas?estado=en_camino
```
Retorna todas las entregas de la ferretería, opcionalmente filtradas por estado.

### Entregas sin repartidor
```
GET /api/entregas/sin-asignar
```
Entregas que están en estado 'asignado' pero sin repartidor aún.

### Asignar repartidor
```
PATCH /api/entregas/[id]/asignar
Body: {
  repartidor_id: "uuid",
  vehiculo_id?: "uuid"  // opcional
}
```

### Marcar como "en camino"
```
PATCH /api/entregas/[id]/en-camino
```
El repartidor salió hacia el cliente. Automáticamente:
- Establece `estado = 'en_camino'`
- Establece `salio_at = NOW()`

### Completar entrega
```
PATCH /api/entregas/[id]/completar
Body: {
  nota?: "Nota de entrega",
  firma_url?: "https://...",
  fotos?: ["https://...", "https://..."]
}
```
Automáticamente:
- Establece `estado = 'entregado'`
- Establece `llego_at = NOW()`
- Calcula `duracion_real_min = (llego_at - salio_at) / 60`
- **Actualiza pedido a estado='entregado'**

## 🎯 Triggers Automáticos

### 1. Crear entrega automáticamente
```sql
TRIGGER: trigger_pedido_crear_entrega
WHEN: UPDATE pedidos
  SET estado = 'confirmado' AND modalidad = 'delivery'
THEN: INSERT INTO entregas (ferreteria_id, pedido_id, zona_delivery_id, ...)
```

Cuando un pedido de delivery se confirma, automáticamente se crea un registro en `entregas`.

### 2. Actualizar timestamps
```sql
TRIGGER: trigger_actualizar_entrega_timestamps
WHEN: UPDATE entregas SET estado
THEN:
  - Si estado='en_camino': SET salio_at = NOW()
  - Si estado='entregado': SET llego_at = NOW()
                           SET duracion_real_min = EXTRACT(EPOCH FROM (NOW() - salio_at)) / 60
```

## 🏗️ Repositorio (OOP)

**File**: `src/lib/db/repositories/entregas.ts`

Encapsula toda la lógica de entregas:

```typescript
const repo = new EntregasRepository(supabase)

// Obtener entregas
await repo.obtenerEntregas(ferreteriaId, 'en_camino')

// Sin repartidor
await repo.obtenerEntregasSinAsignar(ferreteriaId)

// Asignar
await repo.asignarRepartidor(entregaId, repartidorId, vehiculoId)

// Marcar en camino
await repo.marcarEnCamino(entregaId)

// Actualizar GPS
await repo.actualizarGPS(entregaId, lat, lng)

// Completar
await repo.completarEntrega(entregaId, { nota, firmaUrl, fotos })

// Estadísticas
await repo.obtenerEstadisticasPorZona(ferreteriaId)
```

## 🔄 Estados Refactorizados (Migration 042)

Antes: **CHECK constraint hardcodeado** en pedidos.estado
```sql
CHECK (estado IN ('pendiente','confirmado','en_preparacion',...))
```

Ahora: **Tabla `pedido_estados`** separada

```sql
CREATE TABLE pedido_estados (
  id UUID PRIMARY KEY,
  ferreteria_id UUID,
  nombre TEXT,
  slug TEXT,           -- 'pendiente', 'confirmado', etc
  orden INT,           -- para ordenar en UI
  color TEXT,          -- 'gray', 'yellow', 'blue', etc
  icono TEXT,          -- '○', '✓', '⚠️', '📦', etc
  es_final BOOLEAN     -- true si es terminal
)
```

**Beneficios**:
- ✅ Agregar estado sin ALTER TABLE
- ✅ Metadatos por estado (color, icono, orden)
- ✅ Fácil para UI y filtros
- ✅ Escalable para múltiples ferrerías con estados custom

## 📦 Tipos TypeScript

**File**: `src/types/entregas.ts`

```typescript
type EstadoEntrega = 'asignado' | 'en_camino' | 'entregado' | ...

interface Entrega {
  id: string
  estado: EstadoEntrega
  repartidor_id?: string
  // ...
}

interface EntregaConDetalles extends Entrega {
  pedidos: { numero_pedido, nombre_cliente, ... }
  zonas_delivery: { nombre, ... }
  repartidores: { nombre, telefono, ... }
  vehiculos_delivery: { tipo, placa, ... }
}
```

## 🔐 Seguridad (RLS)

Toda la tabla `entregas` está protegida con:

```sql
CREATE POLICY "entregas_access" ON entregas
  FOR ALL USING (ferreteria_id = mi_ferreteria_id())
```

**Solo el dueño de la ferretería puede**:
- Ver sus entregas
- Asignar repartidores
- Actualizar estado

## 📊 Vistas Útiles

```sql
-- Entregas sin asignar (necesitan repartidor)
SELECT * FROM entregas
WHERE estado = 'asignado' AND repartidor_id IS NULL

-- Entregas en ruta ahora
SELECT * FROM entregas
WHERE estado = 'en_camino'

-- Entregas del día
SELECT * FROM entregas
WHERE DATE(created_at) = TODAY()
```

## 🚀 Ejemplo de Uso Completo

```typescript
// 1. Obtener entregas sin repartidor
const repo = new EntregasRepository(supabase)
const sinAsignar = await repo.obtenerEntregasSinAsignar(ferreteriaId)

// 2. Asignar repartidor
await repo.asignarRepartidor(entregas[0].id, 'repartidor-uuid', 'vehiculo-uuid')

// 3. Repartidor marca que salió
await repo.marcarEnCamino(entrega.id)

// 4. Actualizar GPS en tiempo real
await repo.actualizarGPS(entrega.id, -12.0464, -77.0428)

// 5. Completar con firma
await repo.completarEntrega(entrega.id, {
  nota: 'Entregado en perfectas condiciones',
  firmaUrl: 'https://...',
  fotos: ['https://foto1', 'https://foto2']
})
// Automáticamente: pedido.estado = 'entregado'
```

## 🎨 UI Recommendations

### Dashboard de entregas
- **Vista de mapa**: Mostrar entregas en ruta con markers de repartidores
- **Lista pendiente**: Entregas sin asignar, filtradas por zona
- **Timeline**: Historia de estado (asignado → en camino → entregado)

### Portal repartidor
- Entregas asignadas hoy
- Botón "Salir" (marca en_camino)
- GPS tracking
- Botón "Completar" con firma + fotos

## 🔮 Futuras Mejoras

- [ ] Cálculo automático de `distancia_km` usando Google Maps API
- [ ] Optimización de rutas (TSP) para múltiples entregas por repartidor
- [ ] Notificaciones push cuando estado cambia
- [ ] Tracking en tiempo real (WebSocket)
- [ ] Asignación automática de repartidores por zona/carga
- [ ] SLA tracking (tiempo máximo de entrega por zona)
