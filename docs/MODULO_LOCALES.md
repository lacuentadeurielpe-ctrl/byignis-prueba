# 📍 Módulo de Locales con Geolocalización

## Overview

El módulo de locales permite a los dueños de ferreterías gestionar múltiples sucursales con geolocalización automática mediante Google Maps API.

**Ubicación:** Configuración → Negocio → Locales

---

## 🏗️ Arquitectura

### Base de Datos
```
locales_ferreteria (Migration 047)
├── id (UUID)
├── ferreteria_id (FK)
├── nombre: TEXT (obligatorio)
├── codigo: TEXT (ej: L1, SUC-NORTE)
├── direccion: TEXT (obligatorio)
├── lat, lng: DOUBLE (coordenadas)
├── place_id: TEXT (Google Places ID)
├── telefono: TEXT
├── horario_apertura/cierre: TIME
├── dias_atencion: TEXT[]
├── es_principal: BOOLEAN (solo 1 por ferretería)
└── activo: BOOLEAN
```

### APIs REST
| Endpoint | Método | Acción |
|---|---|---|
| `/api/settings-2/negocio/locales` | GET | Lista todos los locales |
| `/api/settings-2/negocio/locales` | POST | Crea nuevo local |
| `/api/settings-2/negocio/locales/[id]` | PATCH | Edita local |
| `/api/settings-2/negocio/locales/[id]` | DELETE | Elimina local |
| `/api/settings-2/integraciones/maps/status` | GET | Estado de Google Maps |

### Componentes React

#### `LocalesForm.tsx`
- Vista principal con lista de locales
- Gestión de estado y operaciones CRUD
- Animaciones con Framer Motion

#### `LocalModal.tsx`
- Modal para crear/editar locales
- Manejo de horarios y días de atención
- Integración con Google Places Autocomplete

#### `PlacesAutocomplete.tsx`
- Input inteligente con autocompletado
- Carga dinámica de Google Maps API
- Extrae coordenadas y place_id automáticamente

### Utilidades

#### `src/lib/maps/geocoding.ts`
```typescript
geocodeAddress(address, apiKey) → { lat, lng, direccion_formateada, place_id }
reverseGeocode(lat, lng, apiKey) → { lat, lng, direccion_formateada, place_id }
```

#### `src/lib/maps/distance.ts`
```typescript
getDistance(origin, destination, apiKey) → { distancia_km, duracion_minutos, ... }
findClosestLocal(target, locales, apiKey) → { local_id, distancia_km }
```

---

## 🚀 Uso en Bot y Pedidos

### Próximo paso 1: Bot selecciona local automáticamente

Cuando cliente solicita delivery:
```typescript
import { findClosestLocal } from '@/lib/maps/distance'

const clienteLat = -12.0464
const clienteLng = -77.0428

const closestLocal = await findClosestLocal(
  { lat: clienteLat, lng: clienteLng },
  ferreteriaLocales, // de DB
  googleMapsApiKey
)

// Bot responde desde local más cercano
```

### Próximo paso 2: Pedido manual muestra local por defecto

Cuando usuario crea pedido:
```typescript
const localPrincipal = locales.find(l => l.es_principal)
// Pre-selecciona este local en el formulario
```

### Próximo paso 3: Distance Matrix para ETA

```typescript
import { getDistance } from '@/lib/maps/distance'

const localCoords = { lat: -12.0464, lng: -77.0428 }
const clienteCoords = { lat: clienteLat, lng: clienteLng }

const distance = await getDistance(localCoords, clienteCoords, apiKey)
// Muestra: "Entrega en aprox. 15 minutos (3.5 km)"
```

---

## 🔐 Seguridad

- **RLS activo:** Mi_ferreteria_id() en todas las queries
- **API Key en env:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- **Validación:** Solo dueños pueden crear/editar/eliminar locales
- **Restricción:** No se puede eliminar el local principal

---

## 🎨 UI/UX Highlights

### Lista de Locales
- ⭐ Indicador visual para local principal
- 🗺️ Iconos por tipo de ubicación
- ✓ Badge de "Ubicación exacta" cuando hay coords
- ⚠️ Alerta si falta geolocalización
- Hover effects y menú contextual

### Modal de Creación
- Buscador con autocomplete en tiempo real
- Confirmación visual de coordenadas obtenidas
- Selector de días de atención (7 botones)
- Vista responsiva (mobile-friendly)
- Bottom sheet en mobile

### Autocomplete
- Filtrado por país (Perú)
- Session tokens para reducir costos
- Manejo de errores graceful
- Loading states

---

## 💰 Costos Google Maps

**Free tier: $200/mes creditado automáticamente**

| API | Costo | Cuándo |
|---|---|---|
| **Geocoding** | $0.005/request | Al guardar dirección (1x) |
| **Places Autocomplete** | $0.00683/request | Mientras escribe (múltiples) |
| **Distance Matrix** | $0.01/request | Al calcular distancia delivery |
| **Directions** | $0.01/request | Al mostrar ruta (futuro) |

**Estrategia de bajo costo:**
- Autocomplete solo con session tokens (reduce costo a $0.007 en confirmación)
- Cacheamos coords una vez en DB, no recalculamos
- Distance Matrix solo cuando se asigna delivery

---

## 📋 Checklist de Integración

- [x] Migración 047: tabla locales_ferreteria
- [x] Tipos en src/types/locales.ts
- [x] APIs REST (GET/POST/PATCH/DELETE)
- [x] Utilidades geocoding.ts y distance.ts
- [x] Componentes UI (PlacesAutocomplete, LocalModal, LocalesForm)
- [x] Integración en settings-2/negocio
- [ ] Integración con bot (próximo)
- [ ] Integración con pedidos manuales (próximo)
- [ ] Distance Matrix para ETA (próximo)
- [ ] Directions para ruta visual (futuro)

---

## 🔧 Troubleshooting

### "Google Maps no cargó"
- Verifica que `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` esté en .env.local
- Revisa en Google Cloud Console que esos servicios estén habilitados

### "No se puede obtener coordenadas"
- Dirección debe ser válida en Perú
- Selectiona de las sugerencias, no escribas a mano

### "Botón de eliminar deshabilitado"
- No puedes eliminar el local principal
- Designa otro como principal primero

---

## 📚 Documentación Relacionada

- [Configuración de Google Maps API](../docs/GOOGLE_MAPS_SETUP.md)
- [Integraciones en Settings 2.0](../docs/SETTINGS_2_0.md)
- [Flujo de Delivery y Repartidores](../docs/DELIVERY_SYSTEM.md)

