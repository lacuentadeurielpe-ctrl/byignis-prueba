# Plan: Superadmin Limpio

**Estado**: Pendiente de implementación  
**Why**: El panel actual mezcla responsabilidades, tiene tablas huérfanas y duplicación de rutas. Se reconstruye desde cero con estructura clara, seguridad robusta, cada sección bien conectada a su base de datos, y capacidad de gestión real sobre la plataforma.  
**Principio**: cada módulo tiene *visibilidad* (qué se muestra) y *gestión* (qué se puede hacer). Ambas son obligatorias.

---

## Filosofía de diseño

- **Un módulo = una responsabilidad**. Ninguna página hace dos cosas.
- **Cada dato tiene una sola fuente de verdad** en la BD. No hay tablas paralelas para lo mismo.
- **Seguridad primero**: todo pasa por `requireSuperadminAdmin`. Las rutas de tenants usan admin client (bypass RLS) pero con validación explícita de parámetros.
- **Nada visible para el tenant llega desde aquí**. Superadmin opera en aislamiento.
- **Toda acción sensible queda registrada** en `superadmin_audit_log` con quién, qué, sobre qué, cuándo y desde qué IP.
- **Acciones destructivas requieren confirmación explícita** con resumen del impacto antes de ejecutar.

---

## Estructura de navegación

```
/superadmin
├── /                    → Dashboard general (KPIs, alertas, acciones rápidas)
├── /tenants             → Lista, búsqueda, filtros, bulk actions
│   └── /[id]            → Ficha completa del tenant + todas las acciones de gestión
├── /planes              → CRUD de planes + matrix de funciones editable
├── /ia                  → Consumo, tarifas editables, facturas internas
├── /billing             → Ingresos, cobro manual, historial, proyección
├── /seguridad           → Log de auditoría, sesiones, alertas, RLS check
├── /salud               → Estado del sistema + acciones de intervención
└── /config              → Configuración global editable de la plataforma
```

---

## Módulo 1 — Dashboard General (`/superadmin/`)

### Visibilidad
- **MRR** (ingreso mensual recurrente en S/ y USD) — suscripciones activas × precio_mensual
- **Costo IA del mes** vs mes anterior — de `movimientos_creditos.costo_usd`
- **Margen bruto estimado** — MRR (USD) − costo IA
- **Tenants activos** vs en trial vs suspendidos
- **Nuevos tenants esta semana**
- **Tenants en riesgo**: creditos_disponibles < 20% de su plan — alerta accionable
- **Tenants sin actividad 7 días**
- **Estado del webhook YCloud** — última llamada / latencia
- **Alertas del sistema** — errores críticos, modelos IA caídos

### Gestión desde el Dashboard
- **Acciones rápidas desde alertas**: cada alerta tiene botón directo sin salir de la pantalla
  - Tenant con créditos bajos → botón "Agregar créditos" (abre modal inline)
  - Tenant inactivo → botón "Ver ficha" / "Enviar recordatorio" (registra nota)
  - Modelo IA caído → botón "Marcar como revisado" (desactiva la alerta)
- **Panel de acciones rápidas** (esquina superior derecha):
  - Registrar pago manual
  - Crear tenant de prueba
  - Activar modo mantenimiento
  - Ver últimas acciones del superadmin (últimas 10, link a `/seguridad`)

### Conexiones a BD
- `suscripciones`, `planes`, `ferreterias`, `movimientos_creditos`

---

## Módulo 2 — Tenants (`/superadmin/tenants`)

### Visibilidad — Lista
- Tabla con columnas: Negocio, Plan, Estado, Créditos restantes (%), Último uso, MRR, Acciones
- Filtros: por plan, por estado, por riesgo (< 20% créditos), por fecha de ingreso, por actividad
- Búsqueda por nombre, teléfono, email del dueño o UUID
- Ordenable por cualquier columna
- Exportación CSV de la lista filtrada

### Gestión — Lista (Bulk Actions)
- Selección múltiple de tenants con checkbox
- **Acciones bulk**:
  - Agregar N créditos a todos los seleccionados (con confirmación y log)
  - Cambiar plan a todos los seleccionados (con confirmación y resumen del impacto)
  - Suspender / reactivar en bloque
  - Exportar datos de los seleccionados a CSV

---

### Visibilidad — Ficha de Tenant (`/superadmin/tenants/[id]`)

**Bloque 1 — Identidad**
- Nombre del negocio, tipo de negocio, teléfono WhatsApp
- Dueño: nombre, email, UUID Supabase Auth
- Fecha de registro, onboarding completo (sí/no)
- Número YCloud asignado

**Bloque 2 — Suscripción & Créditos**
- Plan actual (nombre, créditos/mes, precio)
- Estado: trial / activo / vencido / suspendido
- Créditos disponibles / del mes / extra / consumidos este ciclo
- Fechas: inicio ciclo, fin ciclo, próximo cobro
- Historial de recargas (`recargas_creditos`) — últimas 10

**Bloque 3 — Consumo IA**
- Gráfico últimos 30 días: créditos usados por día
- Desglose por modelo: DeepSeek / Claude / Whisper / Gemini
- Desglose por tipo de tarea: cotizaciones / pedidos / respuestas / audio / imágenes
- Costo real (USD) vs créditos consumidos — comparativa mes anterior

**Bloque 4 — Bot & Conversaciones**
- Estado del bot: activo / pausado
- Total conversaciones activas / cerradas
- Último mensaje procesado (fecha y hora Lima)
- Configuración del bot activa: idioma, personalidad, agentes activos

**Bloque 5 — Actividad reciente**
- Timeline cronológico: cambios de plan, recargas, suspensiones, configuraciones del bot
- Quién hizo cada acción (superadmin_id o "automático")

### Gestión — Ficha de Tenant

**Acciones de suscripción**
- **Cambiar plan**: selector de plan → muestra impacto (créditos actuales, diferencia de precio, fecha efectiva) → confirmación → ejecuta + log en audit
  - Regla de negocio: los créditos disponibles se resetean al cupo del nuevo plan (no se prorratean)
- **Agregar créditos manualmente**: input de cantidad + motivo (campo obligatorio) → registra en `recargas_creditos` con `superadmin_id` + log en audit
- **Resetear ciclo de facturación**: reinicia `ciclo_inicio` a hoy y `creditos_disponibles` al cupo del plan
- **Suspender tenant**: motivo obligatorio → bot se pausa automáticamente → log en audit
  - El tenant ve mensaje personalizable en el dashboard (desde `config_plataforma`)
- **Reactivar tenant**: restaura estado activo → bot no se reactiva automáticamente (el dueño lo activa)

**Acciones de bot**
- **Pausar / reactivar bot manualmente**: con nota interna (no visible al tenant)
- **Ver conversaciones activas**: link a listado de conversaciones de ese tenant (read-only)

**Acciones de cuenta**
- **Agregar nota interna**: texto libre que queda en el timeline (solo visible para superadmin)
- **Asignar plan Vitalicio**: acción especial con doble confirmación ("Esta acción concede IA ilimitada sin costo")
- **Exportar datos del tenant**: JSON con toda la información relevante para auditoría

### Conexiones a BD
- `ferreterias`, `miembros_ferreteria`, `suscripciones`, `planes`
- `movimientos_creditos`, `recargas_creditos`
- `conversaciones`, `mensajes`, `configuracion_bot`
- `superadmin_audit_log` (escritura en cada acción)

---

## Módulo 3 — Planes & Funciones (`/superadmin/planes`)

### Visibilidad — Sección A: Gestión de Planes
- Tabla con los planes activos e inactivos: Gratuito, Esencial, Activo, Vitalicio (+ inactivos)
- Columnas: nombre, créditos/mes, precio S/, es_publico, creditos_ilimitados, # tenants activos en este plan

### Gestión — Planes

**Crear plan**
- Formulario: nombre, créditos/mes, precio mensual S/, precio exceso por crédito S/
- Checkbox: `es_publico` (visible para tenants), `creditos_ilimitados`
- Al crear: inserta en `planes` + redirige a selección de funciones para el nuevo plan

**Editar plan (inline)**
- Nombre, créditos/mes, precio mensual, precio exceso — todos editables inline
- El plan Vitalicio no permite editar precio (siempre S/ 0)
- Al guardar: muestra cuántos tenants activos se ven afectados → confirmación si hay tenants

**Desactivar plan**
- Solo permitido si no hay suscripciones activas en ese plan
- Si hay tenants: muestra lista y bloquea con mensaje "Migra los tenants antes de desactivar"

**Migrar tenants de un plan a otro**
- Selector: plan origen → plan destino → vista previa de tenants afectados → confirmación → ejecución en bloque + log por cada tenant

---

### Visibilidad — Sección B: Matrix de Funciones
- Tabla: función (fila) × plan (columna) — toggle en cada celda
- Agrupado por módulo: Bot / POS / Inventario / Delivery / CRM / IA / Reportes / Integraciones / Sistema
- Cada función muestra: clave, nombre, módulo, descripción en tooltip

### Gestión — Matrix de Funciones
- **Toggle individual**: click en celda → activa/desactiva la función para ese plan → guarda inmediatamente en `plan_funciones`
- **Habilitar todo el módulo para un plan**: botón por grupo (ej. "Activar todo Bot en Activo")
- **Copiar configuración de funciones**: "Copiar de [plan X] a [plan Y]" — reemplaza todas las funciones del plan destino

---

### Visibilidad — Sección C: Funciones de la plataforma
- Lista completa de `funciones_plataforma`: clave, nombre, módulo, descripción, orden
- Cuántos planes incluyen cada función

### Gestión — Funciones
- **Crear función**: clave (slug, único, no editable después), nombre, módulo (select), descripción, orden
- **Editar función**: nombre, descripción, orden — la clave nunca cambia (es el contrato con el código)
- **Reordenar**: drag-and-drop de orden (para futura presentación al tenant)
- **Eliminar función**: solo si no tiene asignaciones en `plan_funciones` (o el superadmin confirma eliminar también las asignaciones)

### Conexiones a BD
- `planes`, `funciones_plataforma`, `plan_funciones`, `suscripciones`
- `superadmin_audit_log` (escritura: crear/editar/desactivar plan, cambio de funciones)

---

## Módulo 4 — Economía IA (`/superadmin/ia`)

### Tab 1 — Consumo (30 días)

**Visibilidad**
- KPIs globales: total créditos consumidos, costo USD total, número de llamadas a IA
- Por modelo: barras con costo, llamadas, créditos
- Por tipo de tarea: barras con créditos usados
- Top consumidores: tabla de tenants ordenados por costo USD (con link a ficha)
- Métricas de eficiencia: costo por llamada, costo por crédito, créditos por llamada

**Gestión desde consumo**
- **Filtrar por tenant**: ver el consumo de un tenant específico en el mismo gráfico
- **Filtrar por modelo**: aislar el costo de un proveedor específico
- **Exportar a CSV**: datos crudos del período filtrado para análisis externo
- **Crear factura interna**: acceso directo al Tab 3 con el período pre-llenado

---

### Tab 2 — APIs & Precios (catálogo de proveedores)

**Visibilidad**
- Tabla de `tarifas_ia`: modelo, proveedor (coloreado), costo entrada /1K tokens, costo salida /1K tokens, precio cobro /1K USD, precio cobro /1K S/, margen % (calculado en vivo), unidad, estado

**Gestión — Tarifas**
- **Edición inline de precios**: costo entrada, costo salida, precio cobro USD, precio cobro S/ — todos editables
  - Al guardar: invalida el caché del bot automáticamente (TTL 5 min) + log en audit
  - Nota persistente en la UI: "Cambios aplican a la siguiente llamada. El historial no se recalcula."
- **Crear nueva tarifa**: modelo (texto libre), proveedor (select), todos los precios, unidad (tokens/minuto/imagen), activar
- **Toggle activo/inactivo**: desactiva el modelo del catálogo sin eliminarlo
- **Historial de cambios**: expansible por fila — últimas 5 ediciones de esa tarifa con quién y cuándo

---

### Tab 3 — Facturas de Gasto Interno

**Visibilidad**
- Lista de facturas por período: fecha inicio, fecha fin, total USD, estado (Borrador/Emitida/Archivada)
- Expansible: desglose por modelo (llamadas, tokens, costo) y por tenant (top 10)

**Gestión — Facturas**
- **Generar factura**: seleccionar período (fecha inicio / fin) → previsualización del total calculado → confirmar → crea registro en `facturas_gasto_ia` con estado "Borrador"
- **Emitir factura**: Borrador → Emitida (bloquea edición, queda como referencia oficial)
- **Archivar factura**: Emitida → Archivada (solo para limpiar el listado, no borra datos)
- **No se puede regenerar** una factura Archivada ni cambiar su período
- **Exportar PDF**: genera documento interno con el desglose para registros contables

### Conexiones a BD
- `movimientos_creditos`, `tarifas_ia`, `facturas_gasto_ia`, `ferreterias`
- `superadmin_audit_log` (escritura: cambio de tarifa, creación/emisión de factura)

---

## Módulo 5 — Billing & Ingresos (`/superadmin/billing`)

**Este módulo no existe todavía — hay que crearlo.**

### Visibilidad
- **MRR timeline**: gráfico histórico mes a mes de ingreso mensual recurrente
- **Breakdown por plan**: qué porcentaje del MRR viene de cada plan
- **Historial de recargas**: todas las compras de créditos por todos los tenants
  - Columnas: fecha, tenant, créditos, monto cobrado S/, concepto, método de pago, superadmin que procesó
- **Deuda pendiente**: tenants con plan de pago (Esencial/Activo) pero sin pago registrado en el ciclo actual
- **Proyección próximo mes**: MRR esperado basado en suscripciones actuales

### Gestión — Billing

**Registrar pago manual**
- Flujo: seleccionar tenant → monto cobrado S/ → concepto (mensualidad / recarga / otro) → método de pago (efectivo / transferencia / Yape / otro) → opcional: agregar créditos extra por ese pago → confirmar
- Registra en `recargas_creditos` con `superadmin_id` + log en audit
- Genera comprobante interno (PDF simple con los datos del pago)

**Editar pago registrado**
- Solo el monto, concepto y método (no la fecha ni el tenant)
- Solo permitido si el pago tiene menos de 7 días (protección de integridad)
- Log de la edición en audit

**Anular pago**
- Requiere motivo obligatorio
- No elimina el registro — lo marca como "Anulado" y revierte los créditos agregados
- Log en audit

**Panel de deuda**
- Lista de tenants con ciclo vencido sin pago
- Botón "Registrar pago" directo desde la fila
- Botón "Suspender por falta de pago" — suspende el tenant y registra motivo automático

**Exportación**
- CSV del historial filtrado por período y/o tenant — para contabilidad externa

### Conexiones a BD
- `recargas_creditos`, `suscripciones`, `planes`, `ferreterias`
- Nueva tabla: `pagos_registrados` (si `recargas_creditos` no es suficiente para contabilidad formal)
- `superadmin_audit_log`

---

## Módulo 6 — Seguridad & Auditoría (`/superadmin/seguridad`)

**Este módulo no existe todavía.**

### Visibilidad
- **Log de acciones**: cada acción sensible del superadmin registrada — quién, qué, sobre qué tenant/recurso, cuándo (Lima), desde qué IP
- **Intentos de acceso fallidos**: al login del superadmin (fecha, IP, email intentado)
- **Sesiones activas**: lista de sesiones de superadmin abiertas con fecha inicio y última actividad
- **Alertas de seguridad**:
  - Tenant con uso anormal (>10× su promedio en 1 hora)
  - Múltiples intentos de acceso fallido (>5 en 10 min desde la misma IP)
  - Webhook recibido con HMAC inválido
- **RLS audit**: estado de RLS en cada tabla crítica (activo / desactivado / sin política)

### Gestión — Seguridad

**Log de auditoría**
- Filtros: por superadmin, por tipo de acción, por tenant, por rango de fechas
- Paginación: 50 registros por página
- Exportar a CSV

**Gestión de sesiones**
- **Revocar sesión**: termina la sesión de otro superadmin (o la propia) invalidando el JWT
- **Revocar todas las sesiones**: en caso de compromiso de cuenta

**Gestión de alertas**
- **Marcar alerta como revisada**: con nota opcional → desaparece del panel activo pero queda en el log
- **Bloquear IP**: agrega la IP a una lista negra que el middleware rechaza (requiere soporte en proxy.ts)
- **Escalar alerta**: marca como crítica y envía notificación al email del superadmin principal

**RLS audit**
- Lista de tablas con su estado de RLS actual (consulta en tiempo real a Supabase)
- Botón "Ver políticas" para cada tabla — muestra el SQL de cada política
- Alerta visual si alguna tabla que debería tener RLS lo tiene desactivado

### Conexiones a BD
- Nueva tabla: `superadmin_audit_log` (superadmin_id, accion, recurso_tipo, recurso_id, metadata JSONB, ip, created_at)
- `superadmins`
- Supabase Auth API (para sesiones y logs de login)

---

## Módulo 7 — Salud del Sistema (`/superadmin/salud`)

**Ya existe parcialmente — expandir.**

### Visibilidad
- **Webhook YCloud**: último mensaje recibido, latencia promedio 24h, tasa de error, mensajes procesados hoy
- **IAs disponibles**: última llamada exitosa a DeepSeek / Claude / Whisper / Gemini + latencia promedio
- **Estado por tenant**: cuántos tienen bot activo / pausado / sin configurar
- **Tenants con bot caído**: no responde a un mensaje en >2 horas
- **Errores recientes del bot**: últimas excepciones del message-handler (desde `error_log` o Vercel logs)
- **Métricas de Vercel**: timeouts de funciones serverless en las últimas 24h

### Gestión — Salud

**Acciones sobre el webhook**
- **Forzar verificación de webhook**: envía una petición de prueba a YCloud y muestra la respuesta
- **Ver últimos N webhooks**: log de los últimos 20 payloads recibidos con estado (procesado / error)

**Acciones sobre los bots**
- **Pausar todos los bots de un plan**: útil para mantenimiento o problema masivo
- **Reactivar todos los bots**: solo los que estaban activos antes de una pausa masiva
- **Activar modo mantenimiento global**: pausa todos los bots de todos los tenants + muestra mensaje configurado en `config_plataforma`
- **Ver log de errores del bot**: filtrable por tenant, por tipo de error, por fecha

**Acciones sobre IAs**
- **Marcar modelo como degradado**: muestra badge de advertencia en la UI del tenant cuando intenta usar esa función
- **Desactivar modelo temporalmente**: en `tarifas_ia.activo = false` — redirige al modelo de fallback configurado en `config_plataforma`

### Conexiones a BD
- `conversaciones` (bot_pausado, updated_at)
- `movimientos_creditos` (última llamada por modelo)
- `tarifas_ia` (para activar/desactivar modelos)
- `config_plataforma` (modo mantenimiento, mensaje de mantenimiento)
- Nueva tabla opcional: `error_log` (ferreteria_id, tipo, mensaje, stack, created_at)

---

## Módulo 8 — Configuración Global (`/superadmin/config`)

**No existe — crear.**

### Visibilidad
- Tabla de todos los parámetros de `config_plataforma`: clave, valor actual, descripción, última modificación, quién modificó

### Gestión — Config

**Parámetros editables**

| Clave | Tipo | Descripción |
|---|---|---|
| `tipo_cambio_usd_pen` | número | Tipo de cambio S/↔USD usado en toda la plataforma |
| `creditos_respuesta` | número | Créditos que cuesta una respuesta simple del bot |
| `creditos_cotizacion` | número | Créditos que cuesta generar una cotización |
| `creditos_pedido` | número | Créditos que cuesta procesar un pedido |
| `creditos_audio` | número | Créditos que cuesta transcribir un audio |
| `creditos_imagen` | número | Créditos que cuesta analizar una imagen |
| `creditos_bienvenida` | número | Créditos que recibe un tenant nuevo al registrarse |
| `modelo_default_bot` | texto | Modelo IA usado para respuestas normales del bot |
| `modelo_default_orquestador` | texto | Modelo IA usado para el orquestador (casos complejos) |
| `modo_mantenimiento` | boolean | Si true: pausa todos los bots y muestra mensaje de mantenimiento |
| `mensaje_mantenimiento` | texto | Lo que ve el cliente cuando el bot está en mantenimiento |
| `mensaje_creditos_agotados` | texto | Lo que le dice el bot al cliente cuando el tenant no tiene créditos |

**Flujo de edición de config**
- Edición inline de cada parámetro con validación por tipo (número, boolean, texto)
- Al guardar: muestra advertencia si el cambio afecta funcionalidad activa (ej: cambiar modelo del bot afecta todas las respuestas en curso)
- **Historial de cambios**: cada parámetro tiene expandible con las últimas 5 ediciones (quién, qué valor anterior, qué valor nuevo, cuándo)
- **Rollback**: botón "Restaurar valor anterior" en el historial de cada parámetro

**Modo mantenimiento** (acción crítica)
- Toggle con doble confirmación: "Esta acción pausará el bot de TODOS los tenants (N tenants activos). ¿Confirmar?"
- Al activar: guarda `modo_mantenimiento = true` en `config_plataforma` + el bot lee este valor antes de procesar cada mensaje
- Al desactivar: restaura el bot solo para tenants que estaban activos (no reactiva los que estaban pausados manualmente)

### Conexiones a BD
- Nueva tabla: `config_plataforma` (clave TEXT UNIQUE, valor JSONB, descripcion TEXT, actualizado_at, actualizado_por UUID)
- `superadmin_audit_log` (escritura: cada cambio de config)
- Bot (`message-handler.ts`): lee `config_plataforma` en startup con caché de 5 min

---

## Tablas nuevas necesarias

| Tabla | Descripción | Prioridad |
|---|---|---|
| `superadmin_audit_log` | Log de todas las acciones sensibles del superadmin | Alta |
| `config_plataforma` | Configuración global editable desde el panel | Alta |
| `error_log` | Registro de errores del bot por tenant | Media |
| `pagos_registrados` | Registro formal de pagos si `recargas_creditos` no es suficiente | Media |

---

## Puntos a Revisar antes de implementar

### Base de datos
- [ ] Verificar que `tarifas_creditos` no tiene dependencias activas antes de eliminarla (revisar FK, código, rutas)
- [ ] Crear `superadmin_audit_log` — log de acciones sensibles con IP y metadata JSONB
- [ ] Crear `config_plataforma` — para sacar los hardcodes del código a la BD
- [ ] Crear `error_log` — para visibilidad de errores del bot desde el panel
- [ ] Verificar que `plan_funciones` y `funciones_plataforma` están bien indexadas
- [ ] Agregar columna `actualizado_por` (superadmin_id) en `tarifas_ia` para auditoría
- [ ] Verificar índice en `suscripciones(ferreteria_id, estado)`
- [ ] Confirmar que RLS está activo en todas las tablas de tenant
- [ ] Las tablas de superadmin (tarifas_ia, planes, etc.) no deben tener RLS de tenant

### Rutas API a limpiar
- [ ] ELIMINAR `/api/superadmin/ia/precios` y `/api/superadmin/ia/precios/[id]` — apuntan a `tarifas_creditos` huérfana
- [ ] ELIMINAR `/api/superadmin/ia/planes` y `/api/superadmin/ia/planes/[id]` — duplican `/api/superadmin/planes`
- [ ] Consolidar gestión de planes en `/api/superadmin/planes` con soporte de `es_publico` y `creditos_ilimitados`
- [ ] Migrar `PlanesManager.tsx` de `x-superadmin-secret` a `requireSuperadminAdmin`
- [ ] Todas las rutas que mutan datos deben escribir en `superadmin_audit_log`

### Seguridad
- [ ] Ninguna ruta superadmin acepta `x-superadmin-secret` como único auth
- [ ] `requireSuperadminAdmin` valida sesión activa en Supabase, no solo JWT
- [ ] Rate limiting en login del superadmin
- [ ] Rutas que reciben `ferreteria_id` verifican que la ferretería existe antes de operar
- [ ] Ninguna ruta expone passwords, tokens de delivery ni credenciales sensibles
- [ ] Plan Vitalicio solo asignable desde el superadmin — ninguna ruta pública lo permite

### UI / UX
- [ ] Navegación lateral refleja todos los módulos con badges de estado (nuevo / alerta)
- [ ] Cada sección tiene estado de carga (skeleton), estado vacío con contexto, y estado de error
- [ ] Las acciones destructivas (suspender, desactivar, archivar) muestran resumen de impacto antes de confirmar
- [ ] El plan Vitalicio visualmente diferenciado con badge dorado y sección separada
- [ ] S/ con 2 decimales; USD con 4 decimales para tarifas de tokens; créditos sin decimales
- [ ] Todas las fechas en zona horaria Lima (America/Lima), nunca UTC crudo
- [ ] Desktop-first — no necesita ser mobile pero sí funcionar en laptops de 13"
- [ ] Logs y tablas de auditoría con paginación (50 registros por página)

### Integridad de datos
- [ ] Al cambiar plan: los créditos disponibles se resetean al cupo del nuevo plan (regla definida)
- [ ] Al agregar créditos manualmente: siempre registrar en `recargas_creditos` con `superadmin_id`
- [ ] Al editar tarifa IA: invalidar caché del bot e informarlo en la UI
- [ ] `creditos_ilimitados = TRUE` en Vitalicio: `descontarCreditos()` debe saltarse la deducción
- [ ] `es_publico = FALSE`: el plan nunca aparece en ninguna vista orientada al tenant

### Conexión con el bot
- [ ] `descontarCreditos()` verifica `creditos_ilimitados` antes de descontar (Vitalicio)
- [ ] `message-handler.ts` lee `config_plataforma.modo_mantenimiento` al inicio de cada mensaje
- [ ] El modelo IA por tarea se lee desde `config_plataforma` (no hardcodeado)
- [ ] Los créditos por tarea se leen desde `config_plataforma` (no hardcodeados)
- [ ] Los errores del bot se registran en `error_log` con ferreteria_id para visibilidad en Salud
