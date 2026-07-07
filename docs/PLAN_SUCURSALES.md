# Plan: Sucursales adicionales (multi-local por tenant)

> **Estado:** PLAN — sin código escrito aún.
> **Fecha:** 2026-07-07
> **Decisión de arquitectura central:** una sucursal **NO es un tenant nuevo**. El tenant sigue siendo la `ferreteria` (mismo RUC, misma suscripción, mismo dueño). La sucursal es una dimensión *intra-tenant*: `local_id` dentro del mismo `ferreteria_id`. RLS no cambia de llave.

---

## 0. Diagnóstico del punto de partida (ya verificado en BD y código)

Lo que ya existe y se reutiliza:

- ✅ Tabla **`locales_ferreteria`** ya creada: `id, ferreteria_id, nombre, codigo, descripcion, direccion, lat, lng, place_id, telefono, horario_apertura, horario_cierre, dias_atencion[], es_principal, activo`. Hoy solo la usan el CRUD de Ajustes → Negocio → Locales y el cálculo de origen de delivery (`eta-preview`, `maps/distance.ts`).
- ✅ RLS multi-tenant sólido: todas las tablas operativas tienen `ferreteria_id` + política `mi_ferreteria_id()`.
- ✅ `sunat_series` con reserva atómica por `(ferreteria_id, tipo_doc, serie)` — extensible a serie-por-sucursal sin tocar el RPC.
- ✅ `getSessionInfo()` como único punto de sesión — lugar natural para inyectar la sucursal activa.
- ✅ `miembros_ferreteria` con `permisos` JSONB — extensible a asignación por sucursal.

Lo que hoy asume "una sola tienda" (los puntos de impacto):

- ❌ `productos.stock` es un número único global → el POS de Sucursal B vendería stock de la A.
- ❌ `pedidos`, `comprobantes`, `rendiciones`, `pagos_registrados`, `compras` no tienen `local_id`.
- ❌ `ferreterias.serie_boletas/serie_facturas` es una serie única para todo el negocio.
- ❌ `vehiculos`, `zonas_delivery`, `repartidores` son globales del tenant.
- ❌ El bot/WhatsApp tiene un solo número y una sola identidad por tenant.
- ❌ Dashboard/Finanzas/Contabilidad agregan todo sin dimensión de local.

---

## 1. Principios de diseño (contrato del proyecto)

1. **`ferreteria_id` sigue siendo LA frontera de seguridad.** RLS no se toca ni se debilita. `local_id` es *autorización de aplicación* (qué ve/opera cada empleado), no aislamiento de datos entre tenants.
2. **Toda columna nueva `local_id` es NULLABLE y con default inteligente.** `NULL` = "local principal / legado". Ningún dato histórico se migra a la fuerza; ningún flujo existente se rompe el día del deploy.
3. **Módulo factorizado:** toda la lógica vive en `src/lib/sucursales/` (contexto, stock, series, helpers). Las páginas/API consumen el módulo; nada de queries ad-hoc por pantalla.
4. **Activación por flag por tenant:** `ferreterias.multi_sucursal BOOLEAN DEFAULT false`. Con flag apagado la app se comporta EXACTAMENTE igual que hoy (un solo local implícito). Esto permite deployar por fases sin riesgo.
5. **La facturación actual no se toca** hasta la fase SUNAT, y esa fase solo AGREGA resolución de serie — `emitirBoleta/emitirFactura` reciben la serie como hoy, solo cambia de dónde sale.

---

## 2. Modelo de datos (FASE 1 — fundamentos)

### 2.1 Promover `locales_ferreteria` a sucursal operativa

- [ ] Migración `106_sucursales_fundamentos.sql`:
  - [ ] `ALTER TABLE locales_ferreteria ADD COLUMN codigo_sunat TEXT DEFAULT '0000'` — código de establecimiento anexo declarado en SUNAT (Ficha RUC: `0001`, `0002`…). El principal es `0000`.
  - [ ] `ALTER TABLE ferreterias ADD COLUMN multi_sucursal BOOLEAN NOT NULL DEFAULT false`.
  - [ ] Función SQL `local_principal_id(ferreteria_id)` → id del local `es_principal` (para defaults).
  - [ ] Backfill: garantizar que TODO tenant tenga exactamente un local `es_principal = true` (crear uno desde `ferreterias.direccion` si no existe).
  - [ ] Constraint: único `es_principal = true` por tenant (índice parcial único).
- [ ] Verificar RLS de `locales_ferreteria` (scoped a `mi_ferreteria_id()`); agregar política si falta.

### 2.2 Dimensión `local_id` en tablas operativas

- [ ] Misma migración, columnas nullable + FK + índice compuesto `(ferreteria_id, local_id)`:
  - [ ] `pedidos.local_id`
  - [ ] `comprobantes.local_id`
  - [ ] `rendiciones.local_id`
  - [ ] `pagos_registrados.local_id`
  - [ ] `compras.local_id`
  - [ ] `vehiculos.local_id` / `vehiculos_delivery.local_id`
  - [ ] `zonas_delivery.local_id`
  - [ ] `repartidores.local_id`
  - [ ] `miembros_ferreteria.local_id` (sucursal asignada; NULL = todas)
- [ ] **NO tocar `productos`** en esta fase (el stock por sucursal es la Fase 4, la más delicada).
- [ ] Actualizar `src/types/database.ts` con las columnas nuevas.

### 2.3 Series SUNAT por sucursal

- [ ] `ALTER TABLE sunat_series ADD COLUMN local_id UUID NULL REFERENCES locales_ferreteria(id)`.
- [ ] Nueva tabla `series_asignadas` **o** columnas en `locales_ferreteria`: `serie_boletas`, `serie_facturas`, `serie_nc_boleta`, `serie_nc_factura`, `serie_nd_boleta`, `serie_nd_factura` (recomendado: columnas en el local — más simple, 1:1 real).
- [ ] Regla de unicidad: una serie (`B002`, `F002`…) pertenece a UN solo local por tenant (constraint).

> **Regla SUNAT (verificada):** mismo RUC = mismo certificado y mismas credenciales SOL. Lo que cambia por establecimiento es la **serie** del comprobante y opcionalmente el **código de establecimiento anexo** en el XML (`codLocal` en el nodo company/address de Greenter — Lycet ya lo soporta en la config de empresa). NO se necesita segundo certificado ni segunda cuenta Lycet.

---

## 3. Contexto de sucursal en sesión (FASE 2 — plomería)

El corazón del diseño. Un solo lugar decide "en qué sucursal estoy operando".

- [ ] `src/lib/sucursales/contexto.ts`:
  - [ ] `getLocalActivo(session)` → resuelve en orden: cookie `local_activo` → `miembros_ferreteria.local_id` del empleado → local principal.
  - [ ] `getLocalesVisibles(session)` → dueño/`local_id=NULL` ve todos; empleado asignado ve solo el suyo.
  - [ ] Server action / API `POST /api/sucursales/activa` para cambiar la cookie (validando que el local pertenezca al tenant Y que el usuario tenga acceso — doble check).
- [ ] Extender `getSessionInfo()` (en `roles.ts`) para devolver `{ localActivoId, localesVisibles, multiSucursal }` — un solo query extra cacheable.
- [ ] **Seguridad (checklist transversal):**
  - [ ] Toda API que reciba `local_id` del cliente lo valida contra `localesVisibles` — nunca se confía en el body.
  - [ ] Los INSERT operativos escriben `local_id` desde el contexto del servidor, no desde el request.
  - [ ] RLS: las políticas existentes ya cubren cross-tenant; el filtro por local es capa de aplicación (documentar esto explícitamente en el código).
- [ ] UI: **selector de sucursal en el header del dashboard** (visible solo si `multi_sucursal=true` y hay >1 local activo):
  - [ ] Dueño: dropdown con "🏠 Todas" + cada local.
  - [ ] Empleado con local asignado: chip fijo no editable (solo informativo).
- [ ] Ajustes → Negocio → Locales: agregar campos nuevos (código SUNAT, series) y el toggle `multi_sucursal` (solo dueño).

---

## 4. Operación por sucursal (FASE 3 — POS, Ventas, Caja)

- [ ] **POS:** toma `localActivoId` del contexto; cada venta escribe `pedidos.local_id` + `comprobantes.local_id`. Indicador visual de sucursal activa en la barra del POS (el cajero SIEMPRE sabe dónde está vendiendo).
- [ ] **Ventas:** filtro por sucursal respetando el selector global; "Todas" agrega con columna/chip de local por fila.
- [ ] **Caja del día / Rendiciones:** una caja por sucursal por día. `rendiciones.local_id` + el generador agrupa por local. La vista "Todas" muestra cajas separadas, no una mezclada.
- [ ] **Facturación (hub Comprobantes):** columna/filtro de sucursal; el tab-filtro existente se mantiene.
- [ ] **Emisión SUNAT:** `resolverSerie(tipoDoc, localId)` en `src/lib/sucursales/series.ts` — reemplaza las lecturas directas de `ferreteria.serie_boletas/serie_facturas` en el adapter. Con flag apagado o local sin serie propia → cae a la serie del tenant (comportamiento actual intacto).
  - [ ] `codLocal` del establecimiento en la config de empresa Lycet cuando el local tenga `codigo_sunat ≠ 0000`.
  - [ ] NC/ND heredan la sucursal del comprobante original (no del contexto del emisor).
- [ ] **Guard de integridad:** correlativo por `(ferreteria_id, tipo_doc, serie)` ya es atómico — no cambia; solo se agregan series nuevas por local.

---

## 5. Stock por sucursal (FASE 4 — la más delicada, va sola)

**Decisión clave (elegir con datos, no de antemano):** dos modos por tenant:

- **Modo A — stock compartido** (default, lo de hoy): un solo stock global. Sucursales comparten inventario. Para negocios con almacén central.
- **Modo B — stock por local:** tabla `stock_locales (producto_id, local_id, ferreteria_id, stock, stock_minimo)` con unique `(producto_id, local_id)`.

Checklist Modo B:

- [ ] Migración `stock_locales` + RLS + backfill: stock actual completo al local principal.
- [ ] `src/lib/sucursales/stock.ts` — ÚNICA puerta de entrada/salida de stock: `descontar(productoId, localId, cant)`, `restaurar(...)`, `consultar(...)`, `transferir(origen, destino, cant)`. Los RPC existentes (`restaurar_stock_parcial`, descuentos del POS/bot) se redirigen aquí.
- [ ] **Transferencias entre sucursales:** tabla `transferencias_stock (id, ferreteria_id, local_origen, local_destino, estado: pendiente|en_transito|recibida|cancelada, items JSONB, creado_por, recibido_por)` + UI simple en Catálogo (botón "Transferir") + notificación al recibir.
- [ ] Puntos de consumo a redirigir (mapeados hoy):
  - [ ] POS (venta directa)
  - [ ] Bot `crear_pedido`
  - [ ] Modales de pedido del dashboard
  - [ ] NC devolución (restaura al local del comprobante)
  - [ ] Realtime `useRealtimeProductos` → escuchar también `stock_locales`
- [ ] Catálogo: vista de stock por columna-sucursal (o desplegable por producto); alertas de stock mínimo por local.
- [ ] `productos.stock` pasa a ser columna calculada/espejo (suma de locales) para no romper lecturas legadas — con trigger o vista.

---

## 6. Delivery por sucursal (FASE 5)

- [ ] Asignación de vehículos y repartidores a un local (`local_id` ya agregado en Fase 1).
- [ ] `zonas_delivery.local_id`: cada sucursal cubre sus zonas; el motor de asignación (`assignment.ts`/agenda) filtra vehículos del local del pedido.
- [ ] Origen de ruta = dirección del local del pedido (ya existe la infraestructura en `maps/distance.ts` — hoy usa `locales_ferreteria`, conectar el punto).
- [ ] Pedido WhatsApp con dirección: resolver sucursal por zona de cobertura → setear `pedidos.local_id` automáticamente; sin match → local principal + alerta al staff.

---

## 7. Equipo y permisos por sucursal (FASE 6)

- [ ] Invitaciones: al invitar empleado, elegir sucursal (o "todas").
- [ ] `checkPermiso` no cambia; el scoping de datos por local viene del contexto (Fase 2).
- [ ] Vista Equipo en Ajustes: columna de sucursal por miembro, editable por el dueño.
- [ ] Auditoría (`acciones_auditadas`): registrar `local_id` en acciones sensibles.

---

## 8. Bot / WhatsApp multi-sucursal (FASE 7 — opcional, al final)

Dos modelos, activables por tenant:

- **Un número, N sucursales** (recomendado para empezar): el bot pregunta/deduce sucursal por dirección de entrega o por preferencia guardada del cliente (`clientes.local_preferido_id`). Cero costo extra de números.
- **Un número por sucursal** (futuro): `configuracion_ycloud/meta.local_id` + el webhook resuelve tenant+local por número receptor. Requiere N líneas WhatsApp Business.

Checklist mínima (modelo 1):

- [ ] `clientes.local_preferido_id` nullable.
- [ ] El prompt del orquestador recibe la lista de sucursales (nombre, dirección, horario) para responder "¿dónde están ubicados?".
- [ ] `crear_pedido` del bot setea `local_id` (por zona o preferencia).

---

## 9. Reportes y finanzas (FASE 8)

- [ ] Dashboard: KPIs respetan el selector (Todas = consolidado + mini-breakdown por local).
- [ ] Finanzas: dimensión sucursal en ingresos/egresos; comparativa entre locales (tabla simple, no gráficos nuevos al inicio).
- [ ] Contabilidad (Registro de Ventas): columna serie ya identifica el local (B001 vs B002) — solo agregar el filtro.
- [ ] Salud Fiscal: sin cambios (opera por tenant/RUC, correcto así).

---

## 10. Qué NO hacer (anti-decisiones documentadas)

- ❌ **NO crear un tenant/ferretería por sucursal.** Duplicaría suscripción, credenciales SUNAT, catálogo y equipo; el RUC es uno solo y SUNAT trata las sucursales como establecimientos anexos del mismo contribuyente.
- ❌ **NO meter `local_id` en las políticas RLS.** La frontera de seguridad es el tenant; hacer RLS por local rompería la vista consolidada del dueño y complica el JWT sin ganancia real de seguridad.
- ❌ **NO migrar el stock a `stock_locales` de golpe para todos.** Solo tenants que activen Modo B, con backfill al local principal.
- ❌ **NO duplicar catálogo por sucursal.** Productos y precios son del tenant; solo el stock (y opcionalmente precio por local, futuro lejano) varía.

---

## 11. Orden de ejecución y riesgo

| Fase | Contenido | Riesgo | Depende de |
|---|---|---|---|
| 1 | Migraciones fundamentos + tipos | Bajo (columnas nullable) | — |
| 2 | Contexto de sesión + selector UI + CRUD locales ampliado | Bajo | 1 |
| 3 | POS/Ventas/Caja/Series SUNAT por local | Medio (toca emisión — solo resolución de serie) | 2 |
| 4 | Stock por local + transferencias | **Alto** (toca POS, bot, NC, realtime) | 3 |
| 5 | Delivery por local | Medio | 2 |
| 6 | Equipo/permisos por local | Bajo | 2 |
| 7 | Bot multi-sucursal | Medio | 3, 5 |
| 8 | Reportes/finanzas | Bajo | 3 |

Cada fase: `npm run build` → commit propio → deploy verificado → prueba manual antes de la siguiente. Las fases 4 y 7 se pueden posponer indefinidamente sin bloquear el resto.

---

## 12. Criterios de aceptación globales

- [ ] Con `multi_sucursal = false` (todos los tenants actuales): CERO cambios de comportamiento observables.
- [ ] Un empleado asignado a Sucursal B no puede ver ni operar ventas/caja de la A (verificado por API directa, no solo UI).
- [ ] Un request con `local_id` de otro tenant devuelve 403/404 (validación contra `localesVisibles`).
- [ ] Boleta emitida en Sucursal B sale con serie B002 y correlativo propio; SUNAT la acepta; el Registro de Ventas la muestra bajo esa serie.
- [ ] NC de un comprobante de Sucursal B hereda local y serie de NC del local B.
- [ ] El dueño en "Todas" ve consolidado consistente (suma de locales = total tenant).
- [ ] Venta en Modo B descuenta stock SOLO del local vendedor.
