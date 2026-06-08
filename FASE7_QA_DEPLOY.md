# FASE 7: QA & DEPLOY - Settings Enterprise-Grade 2.0

## 📋 CHECKLIST QA COMPLETO

### 1. SMOKE TESTS (Flujos Críticos)

#### NEGOCIO
- [ ] Guardar datos generales (nombre, teléfono, dirección)
- [ ] Verificar que se persisten en /dashboard/settings-2
- [ ] Verificar que se leen en páginas consumidoras
- [ ] Prueba de horarios: guardar, leer, validar formato
- [ ] Prueba de métodos pago: agregar Yape, Plin, transferencia

#### INTEGRACIONES
- [ ] YCloud: Conectar, guardar API Key, verificar status
- [ ] Nubefact: Conectar modo prueba, cambiar a producción
- [ ] Mercado Pago: OAuth flow (si se integró)
- [ ] Google Maps: Guardar API Key, status conectado

#### EQUIPO
- [ ] Crear empleado, verificar en miembros_ferreteria
- [ ] Crear repartidor con PIN auto-generado
- [ ] Verificar empleados aparecen en lista

#### CATÁLOGO
- [ ] Crear categoría, guardar, eliminar
- [ ] Crear tier de descuento (100 unidades = 10%)
- [ ] Crear unidad de medida (Metro)

#### BOT
- [ ] Guardar nombre y instrucciones del bot
- [ ] Toggle agentes (activar/desactivar)
- [ ] Agregar productos complementarios

#### DELIVERY
- [ ] Crear zona (Centro, 5km, 30min, S/5)
- [ ] Crear vehículo (Moto, ABC-123)
- [ ] Verificar en zonas_delivery y vehiculos_delivery

#### AVANZADO
- [ ] Toggle módulos (activar/desactivar)
- [ ] Cambiar políticas (venta sin stock, aprobación crédito)
- [ ] Ver logs en tabla de auditoría

### 2. SECURITY REVIEW

#### Multi-Tenancy
- [ ] Verificar ferreterias solo ven sus datos
- [ ] Test: Cambiar session.ferreteriaId, verificar acceso denegado
- [ ] RLS policies en Supabase funcionando

#### Auth & Authorization
- [ ] Solo rol 'dueno' puede acceder a settings-2
- [ ] Empleados NO pueden ver settings
- [ ] API retorna 403 si rol != 'dueno'

#### Data Validation
- [ ] E.164 teléfono: +51 válido, sin validar
- [ ] RUC: 10 o 11 dígitos según tipo
- [ ] Regimen tributario: valores permitidos
- [ ] Métodos pago: array validado

#### Secrets Management
- [ ] API Keys masked en UI (***...xyz)
- [ ] Nunca loguear keys completas
- [ ] Toggle show/hide funcional

### 3. PERFORMANCE

#### Load Times
- [ ] Settings 2.0 Hub: < 2s
- [ ] Cada sección: < 1.5s
- [ ] API responses: < 500ms

#### Bundle Size
- [ ] Next.js build: sin bloat
- [ ] No duplicate dependencies
- [ ] Tree-shaking funcionando

### 4. DATA INTEGRITY

#### APIs
- [ ] GET retorna datos correctos
- [ ] POST crea, PATCH actualiza, DELETE elimina
- [ ] No orphaned records
- [ ] Timestamps (created_at, updated_at) correctos

#### Cascading Updates
- [ ] Si cambio ferreterias.nombre, no rompe dashboard
- [ ] Si creo repartidor, auditoria logea el evento
- [ ] Si conecto YCloud, integracion_logs registra

## 🔌 INTEGRACIÓN PENDIENTE CON MÓDULOS

### CRÍTICAS (Deben conectarse antes de deploy)

| Módulo | Setting | Consumidor | Estado | Acción |
|--------|---------|-----------|--------|--------|
| Negocio | nome | /dashboard/dashboard (header) | ⚠️ CHECK | Verificar que se usa |
| Horarios | dias_atencion | bot/business-hours-check.ts | ⚠️ CREAR | Crear archivo consumidor |
| Pagos | metodos_pago_activos | /dashboard/pagos (checkout) | ⚠️ CHECK | Verificar integración |
| Nubefact | token + modo | lib/sunat/nubefact.ts | ✅ EXISTS | Conectar a settings-2 API |
| Categorías | categorias_producto | bot/intent-parser | ⚠️ CHECK | Verificar que se usa |
| Descuentos | descuentos_tiers | vendedor/pricing.ts | ⚠️ CHECK | Verificar lógica aplicada |
| Bot | bot_instrucciones | ai/deepseek.ts | ⚠️ CHECK | Verificar que se inyecta |
| Zonas | zonas_delivery | delivery/zone-matcher.ts | ⚠️ CHECK | Verificar que se consulta |

### OPCIONALES (Post-deploy v1.1)

- Módulos activos → middleware feature gates
- Políticas → checkout validation
- Agentes → agent router
- Complementarios → upsell engine

## 🧪 SMOKE TEST SCRIPT

```bash
# 1. Crear ferretería test
POST /api/settings-2/negocio/general {
  "nombre": "Test Ferretería",
  "telefono": "51987654321",
  "direccion": "Jr. Test 123"
}

# 2. Crear categoría
POST /api/settings-2/catalogo/categorias {
  "nombre": "Materiales",
  "icono": "🏗️"
}

# 3. Crear zona
POST /api/settings-2/delivery/zonas {
  "nombre": "Centro",
  "radio_km": 5,
  "eta_minutos": 30,
  "costo_delivery": 5
}

# 4. Conectar YCloud
POST /api/settings-2/integraciones/ycloud {
  "api_key": "sk_test_xxx"
}

# 5. Verificar logs
GET /api/settings-2/avanzado/logs
  → Debe mostrar 4 eventos (general, categoría, zona, ycloud)
```

## 📦 DEPLOYMENT CHECKLIST

### Pre-Deploy
- [ ] Todos los smoke tests pasan
- [ ] Security review OK
- [ ] Build: `npm run build` sin errores
- [ ] TypeScript: sin warnings
- [ ] Lint: `npm run lint` limpio

### Deploy
- [ ] Git push a main
- [ ] Vercel deploy automático
- [ ] Esperar build completion
- [ ] Test producción: settings-2 page carga

### Post-Deploy
- [ ] Monitorear logs Vercel (errores RLS)
- [ ] Verificar que datos persistentes se leen
- [ ] Ping a usuarios: Settings 2.0 funcionando

## 🎯 GO/NO-GO DECISION

**GO if:**
- ✅ Todos smoke tests pasan
- ✅ Security review: sin críticos
- ✅ RLS policies correctas
- ✅ Multi-tenancy aislamiento verificado

**NO-GO if:**
- ❌ Algún test falla
- ❌ Data leak entre ferreterías
- ❌ API retorna datos de otra ferretería
- ❌ Settings no persisten

