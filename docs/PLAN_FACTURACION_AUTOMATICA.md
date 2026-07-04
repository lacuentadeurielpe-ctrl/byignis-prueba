# Plan: Facturación automática estilo ERP (gestión por excepción)

> Estado: PLAN — sin código todavía. Fecha: 2026-07-03
> Prerrequisito cumplido: emisión individual en producción funcionando (B001-22 aceptada con CDR 0),
> credenciales cifradas AES-256-GCM, motor Lycet operativo en Railway.

## Principio rector

**El humano no opera la facturación; solo atiende excepciones.** Cada venta emite su
comprobante sola, los errores se reintentan solos, las anulaciones se procesan solas,
y el dueño únicamente ve un semáforo: verde (todo declarado), ámbar (reintentando),
rojo (necesita su decisión). Así operan los ERP y así exige trabajar SUNAT.

## Contexto normativo (por qué el panel actual está mal)

- Desde 2023 SUNAT exige que las **boletas se informen individualmente** (envío en línea,
  plazo máximo de 3 días calendario desde la emisión). El sistema YA hace esto en cada venta.
- El **Resumen Diario (RC) dejó de ser el mecanismo de declaración** de boletas. Su único
  uso vigente es **ANULAR boletas** ya informadas (detalle con estado '3').
- Las **facturas se anulan con Comunicación de Baja (RA)**, no con RC.
- Conclusión: el panel de Contabilidad que agrupa boletas del día para "declararlas"
  manualmente es redundante (ya están declaradas) y riesgoso (re-declaración).

## Estado actual (auditoría)

| Pieza | Estado | Problema |
|---|---|---|
| Emisión por venta (POS/Ventas/bot) | ✅ Automática, tiempo real, CDR inmediato | Si Lycet/SUNAT está caído, la venta falla o queda sin comprobante y **nadie reintenta** |
| Panel RC en Contabilidad | ⚠️ Manual | Re-declara boletas ya aceptadas; botones "Enviar RC" y "Consultar CDR" manuales |
| Anulación de boletas | ❌ No existe flujo real | El RC debería usarse solo para esto |
| Anulación de facturas (RA) | ❌ No existe | Comunicación de Baja sin implementar |
| Consulta de tickets RC | ⚠️ Manual (botón) | SUNAT responde asíncrono; nadie consulta si el dueño no entra |
| Boletas con error de envío | ❌ Quedan huérfanas | `estado='error'` sin reintento; el plazo legal de 3 días corre |
| Ruta resumen-diario | ⚠️ Acoplada | Llama a Lycet directo, se salta el adapter |
| Código legacy | 🧹 | `greenter-service/`, restos en `emitir.ts` |

## FASE 1 — Motor de emisión con cola de reintentos (el corazón ERP)

**Objetivo:** ninguna venta se queda sin comprobante por un fallo transitorio.

- Nuevo estado de ciclo de vida en `comprobantes`: `pendiente_envio` → `enviando` →
  `aceptado` / `error_reintentable` / `error_definitivo`.
- **Job de reintentos** (Inngest, ya está en el stack): cada 10-15 min toma comprobantes
  en `error_reintentable` o `pendiente_envio` y los reenvía con backoff. Corta al acercarse
  el límite legal (3 días) y escala a rojo.
- Clasificación de errores en el adapter: red/timeout/5xx de Lycet = reintentable;
  rechazo CDR de SUNAT (código 100-3999) = definitivo (requiere corrección humana).
- **Modo asíncrono opcional para el POS**: la venta cierra al instante (`pendiente_envio`)
  y el envío corre en background. El cajero nunca espera a SUNAT. Configurable por negocio;
  default: síncrono como hoy (el CDR inmediato da confianza).
- Todo pasa por `ProveedorFacturacion` — cero llamadas directas a Lycet fuera del adapter.

## FASE 2 — Reconvertir el RC: solo anulaciones, y automáticas

**Objetivo:** eliminar el flujo manual "agrupar y enviar boletas del día".

- **Quitar** del panel de Contabilidad el envío de RC de declaración y el botón
  "Consultar CDR" manual.
- **Nuevo flujo de anulación de boleta** (el único uso legítimo del RC):
  1. En Comprobantes, botón "Anular" sobre una boleta aceptada → pide motivo → la marca
     `anulacion_pendiente`.
  2. Un job (Inngest, corre p. ej. cada hora y a las 19:00 Lima) agrupa las anulaciones
     pendientes del día, arma el RC de bajas (estado '3'), lo envía, y **consulta el
     ticket automáticamente** hasta obtener el CDR.
  3. Boleta pasa a `anulado` con evidencia (CDR del RC) o vuelve a pendiente con alerta.
- **Comunicación de Baja (RA) para facturas**: mismo patrón (botón Anular → job → CDR),
  usando el endpoint `voided` de Lycet.
- La ruta resumen-diario se reescribe detrás del adapter (`anularBoleta()` en la interface).

## FASE 3 — Conciliación y vigilancia automática

**Objetivo:** que el sistema se audite solo, todas las noches.

Job nocturno (1:00 am Lima) por negocio:
- **Ventas sin comprobante**: pedidos pagados con tipo boleta/factura sin comprobante
  aceptado → alerta.
- **Comprobantes por vencer plazo**: `pendiente/error_reintentable` con >2 días → rojo.
- **Tickets RC/RA sin resolver**: auto-consulta; si SUNAT rechazó, revierte estados.
- **Certificado por vencer** (<30 días): ya existe el banner; agregar notificación activa.
- **Notificación por excepción**: WhatsApp (vía la propia plataforma) o email al dueño
  SOLO si hay rojos. Silencio = todo bien. Nunca spamear con "todo OK".

## FASE 4 — Contabilidad se convierte en "Salud Fiscal"

**Objetivo:** el panel deja de ser un lugar donde se trabaja y pasa a ser un lugar donde se mira.

- **Semáforo del día/mes**: emitidas y aceptadas / en reintento / rechazadas / anuladas,
  con montos. Un vistazo y el dueño sabe si está al día con SUNAT.
- **Bandeja de excepciones**: solo lo que requiere acción humana (rechazos definitivos
  con guía del código CDR, anulaciones fallidas, ventas sin comprobante).
- **Exportes para el contador**: Registro de Ventas del período (CSV/Excel), XMLs y CDRs
  descargables en lote. Esto es lo que el contador pide cada mes — hoy no existe.
- Textos "negocio" (no "ferretería"), sin jerga SUNAT innecesaria en la UI.

## FASE 5 — Limpieza y cierre

- Eliminar `greenter-service/` (obsoleto — Lycet lo reemplazó).
- Migrar/retirar restos de `src/lib/comprobantes/emitir.ts` que dupliquen al adapter.
- `CRON_SECRET` no está en Vercel (detectado 2026-07-03): configurarlo antes de exponer
  los cron endpoints de las fases 1-3.
- Revisar homologación: con emisión individual funcionando en producción, simplificar o
  retirar el flujo de "boletas de prueba" si ya no aporta.

## Orden y dependencias

```
FASE 1 (reintentos)  ──►  FASE 3 (conciliación)  ──►  FASE 4 (UI Salud Fiscal)
FASE 2 (RC=anulaciones) ──┘                            FASE 5 (limpieza, al final)
```

Fases 1 y 2 son independientes entre sí y las más urgentes:
- Fase 1 protege el flujo de dinero (ninguna venta sin comprobante).
- Fase 2 elimina el riesgo activo de re-declaración y habilita anular (necesidad real
  del día a día: cliente devuelve, cajero se equivoca).

## Qué NO se hace

- No se toca `ycloud.ts` (regla del proyecto).
- No se construye módulo de automatizaciones genérico — estos son jobs internos del
  dominio facturación, no automatizaciones configurables por el usuario.
- No se cambia el motor (Lycet quedó estable) ni la capa de adapters — se reutiliza.
