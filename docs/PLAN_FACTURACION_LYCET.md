# Plan: Reconstrucción robusta de Facturación Electrónica

Tres pilares que se refuerzan: **(A) Motor SUNAT sobre biblioteca oficial**,
**(B) Base de datos bien modelada**, **(C) UI/UX unificada y accionable**.
No se construye nada hasta aprobar este plan.

---

## 🔎 Auditoría: qué está mal HOY (hallazgos concretos, verificados en el código)

### Motor SUNAT (back)
- El XML se arma **a mano** en `DocumentoFactory.php` → cada campo olvidado = rechazo SUNAT
  (caso real: faltaba `setSubTotal`/`setFormaPago`). Frágil y sin validación previa.
- No hay validación local contra reglas SUNAT antes de enviar.

### Base de datos (verificado en migraciones)
- **`comprobantes.estado` sigue siendo solo `('emitido','anulado','error')`** (migración 003, nunca
  ampliada). El ciclo real SUNAT (aceptado / aceptado-con-observaciones / rechazado / pendiente-de-RC)
  **no está modelado**; el CDR se guardó como columnas sueltas (`sunat_cdr_codigo`) parcheadas encima.
- **No existe `fecha_emision` fiscal.** El RC usa `created_at` con un hack de rango `T00:00` — una
  boleta emitida 11pm para un día fiscal distinto rompe el resumen.
- **No hay `moneda`** — PEN hardcodeado en todo. Facturas en USD imposibles.
- **Series como columnas sueltas** (`ferreterias.serie_boletas/serie_facturas`). Sin soporte
  multi-serie / sucursal / terminal POS. Correlativo = `MAX(numero)+1`; ante fallos o huecos
  **puede desincronizarse con el correlativo real de SUNAT** (sin reserva/rollback).
- **`sunat_credenciales` no guarda `cert_vence_at`** — los certificados vencen; sin aviso proactivo.
- **No hay bitácora del intercambio con SUNAT** (request/response/CDR zip). Imposible depurar un
  rechazo después de que ocurre.
- `greenter_url` default apunta a un dominio viejo (`greenter-api.byignis.com`).

### UI/UX (verificado en componentes)
- **No hay un hub único de "Facturación Electrónica".** Está fragmentado: los modales de emisión
  viven en Ventas, el estado CDR en ningún lado, el RC + libros PLE en Contabilidad, las credenciales
  en Ajustes. El dueño no tiene una vista de "mis comprobantes y su estado en SUNAT".
- **`ComprobantesTable` pinta cualquier `estado==='emitido'` como verde "Aceptado"** — una boleta con
  observaciones SUNAT (CDR 4000+) o pendiente de RC se ve idéntica a una aceptada limpia. No muestra
  código/descripción CDR ni si ya fue declarada en un RC.
- **El panel RC usa `alert()`** para errores de consulta CDR — inconsistente con el resto.
- Sin skeletons de carga; errores crudos del backend (ej. 0111) sin guía accionable en el punto de fallo.
- `ContabilidadPanel` (457 líneas) apila tres cosas sin relación: Compras, Libro de Ventas PLE, RC.

---

## PILAR A — Motor SUNAT sobre Lycet (biblioteca oficial)

Reemplazar `greenter-service/` casero por **Lycet** (API REST oficial de Greenter, multi-tenant,
con validación `greenter/validator` y PDF `greenter/report`). La interfaz `ProveedorFacturacion`
se preserva; solo cambia el motor por dentro.

- **A1** `npm i node-forge @types/node-forge`. Convertir PFX→PEM en Node (evita gotcha OpenSSL legacy).
- **A2** Desplegar Lycet en Railway (servicio nuevo, en paralelo; Dockerfile con wkhtmltopdf +
  volumen `/data`). Verificar endpoints.
- **A3** `src/lib/facturacion/lycet/{cert,client,mappers}.ts`: conversión de cert, cliente HTTP,
  y construcción del JSON en formato modelo Greenter (invoice/note/summary).
- **A4** `ensureCompany()` registra la empresa en Lycet (`PUT /configuration/company/{ruc}`),
  idempotente antes de emitir → stateless, robusto ante redeploys.
- **A5** Reescribir el cuerpo de `sunat-directo-adapter.ts` (firma pública intacta) y del RC.
- **A6** PDF/XML desde Lycet como canónicos; React-PDF de fallback.
- **A7** Borrar `greenter-service/**`.

## PILAR B — Base de datos bien modelada

- **B1** Migración: **ciclo de vida del comprobante** correcto.
  `comprobantes.estado_sunat` TEXT CHECK (`borrador`,`enviado`,`aceptado`,`aceptado_obs`,`rechazado`,`anulado`,`baja`).
  Dejar `estado` legacy mapeado. Guardar `cdr_codigo`, `cdr_descripcion`, `cdr_notas` (JSONB), `cdr_zip_url`.
- **B2** `comprobantes.fecha_emision DATE` (fiscal, separada de `created_at`). Backfill desde `created_at`
  en zona Lima. El RC pasa a filtrar por `fecha_emision` (elimina el hack `T00:00`).
- **B3** `comprobantes.moneda TEXT NOT NULL DEFAULT 'PEN'` + `tipo_cambio NUMERIC`. Habilita USD.
- **B4** `comprobantes.cert_vence_at` no — va en credenciales: `sunat_credenciales.cert_vence_at TIMESTAMPTZ`
  + `cert_pem_enc TEXT` (para Lycet). Extraer vencimiento del PFX al guardar (node-forge).
- **B5** Tabla **`sunat_series`** (ferreteria_id, tipo_doc, serie, correlativo_actual, sucursal, activo)
  → multi-serie real; correlativo con reserva atómica y rollback si SUNAT rechaza.
- **B6** Tabla **`sunat_log`** (comprobante_id, direccion, endpoint, request_resumen, response_resumen,
  cdr_codigo, http_status, created_at) → bitácora para depurar. Sin secretos (nunca cert/clave).
- **B7** Regenerar tipos `src/types/database.ts`. Migración de datos segura (todo `IF NOT EXISTS`,
  backfill idempotente). Revisar RLS de las tablas nuevas.

## PILAR C — UI/UX unificada y accionable

- **C1** Nuevo hub **Facturación Electrónica** (`/dashboard/finanzas` → pestaña propia o página):
  una sola vista con comprobantes emitidos + su estado real SUNAT + RC + certificado.
- **C2** `ComprobantesTable` robusto: badge por estado SUNAT real (aceptado / con observaciones /
  rechazado / pendiente RC), mostrar código+descripción CDR, indicador "declarado en RC", PDF/XML
  siempre accesibles, filtros por tipo/estado/fecha, búsqueda, paginación.
- **C3** Panel de **estado de conexión SUNAT**: certificado (vence en X días, alerta si <30),
  progreso de homologación, modo beta/producción, test de conexión — visible sin entrar a Ajustes.
- **C4** Errores accionables: cuando SUNAT devuelve 0111 u otro código conocido, mostrar la guía
  inline (trámite SOL) en el punto de fallo, no un string crudo. Reemplazar `alert()` por toasts/inline.
- **C5** RC integrado al hub, con estados de carga (skeletons), vacío y error consistentes.
- **C6** Vocabulario **"negocio"** (no "ferretería"); consistencia visual con el resto del panel.
- **C7** Modal de emisión: si Lycet devuelve error de validación, señalar el **campo exacto**.

---

## 🔀 Orden de ejecución sugerido

1. **PILAR B primero** (cimiento): migraciones + tipos. No rompe nada (columnas nuevas, backfill).
2. **PILAR A** (motor): Lycet en paralelo, adapter reescrito leyendo/escribiendo el nuevo esquema.
3. **PILAR C** (UI): sobre datos ya ricos y motor confiable.
4. Verificación end-to-end en beta → cutover → apagar servicio viejo → deploy.

## ✅ Verificación final (runtime, no tests)
- Emitir boleta beta → CDR 0 → PDF descargable → estado SUNAT correcto en el hub.
- Emitir factura beta → sin 3305 (validación previa) → USD si aplica.
- RC → ticket → CDR → boletas marcadas "declaradas".
- Certificado próximo a vencer → alerta visible.
- `npm run build` limpio; cutover; deploy Vercel + Railway.

---

## 🗂️ Archivos (resumen)

**Nuevos:** `lycet-service/`, migraciones `095`–`098` (estado_sunat/fecha/moneda, cert, series, log),
`src/lib/facturacion/lycet/{cert,client,mappers}.ts`, hub UI de Facturación + componentes.

**Modificados (cuerpo, no firma):** `sunat-directo-adapter.ts`, ruta RC, rutas credenciales/homologar/test,
ruta PDF, `ComprobantesTable.tsx`, `ContabilidadPanel.tsx`, `src/types/database.ts`.

**Borrados:** `greenter-service/**`.

**Preservados:** `types.ts`, `resolver.ts`, `nubefact-adapter.ts`, cifrado AES-256-GCM, split billing,
tablas base y RLS existentes.
