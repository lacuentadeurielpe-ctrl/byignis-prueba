# PLAN — Notas de Crédito/Débito completas + Guías de Remisión Electrónica (GRE)

> Estado: **PLANIFICADO — sin código aún**
> Fecha de auditoría: 2026-07-05
> Regla de oro: **NO tocar el motor de boletas/facturas** (emisión, reintentos,
> anulaciones, conciliación, Salud Fiscal). Todo lo nuevo se conecta por los
> puntos de extensión existentes (`ProveedorFacturacion`, `resolverProveedor`,
> `sunat_series`, `sunat_log`).

---

## 1. DIAGNÓSTICO (auditado en el código, no de memoria)

### 1.1 Notas de Crédito — EXISTE (~75% completo)

Lo que ya funciona y NO se reescribe:

| Pieza | Archivo | Estado |
|---|---|---|
| Emisión NC vía Lycet (`tipoDoc 07`, `/note/send`) | `sunat-directo-adapter.ts → emitirNotaCredito` | ✅ |
| Mapper Greenter (`mapearNota`, campo `numDocfectado` exacto) | `lycet/mappers.ts` | ✅ |
| Correlativo atómico series BC01/FC01 | `lycet/comun.ts → reservarCorrelativo('07', …)` | ✅ |
| Ruta API vía resolver (bug Nubefact ya corregido) | `/api/comprobantes/nota-credito` | ✅ |
| Modal con devolución parcial por ítem | `ModalNotaCredito.tsx` | ✅ |
| Restauración de stock al aceptar | adapter (rpc `restaurar_stock_parcial`) | ✅ |
| hash_cpe + qr_cadena guardados | adapter (recién agregado) | ✅ |
| Bitácora en `sunat_log` | `escribirLog('envio','note/send',…)` | ✅ |

**Brechas detectadas (esto es lo que se completa):**

1. **Catálogo 09 incompleto**: el modal solo ofrece 4 de 13 motivos
   (01, 02, 06, 07). Faltan 03 corrección por error en descripción,
   04 descuento global, 05 descuento por ítem, 08 bonificación,
   09 disminución en el valor, 13 ajuste de montos, etc.
2. **Ítems sin `producto_id` no se pueden devolver**: el matching de
   `itemsDevueltos` es por `producto_id` — un ítem libre (NULL) o dos líneas
   del mismo producto colisionan. Debe matchear por `items_pedido.id`.
3. **Nota de Débito (tipo 08) no existe**: ni adapter, ni ruta, ni UI.
   El mapper `mapearNota` sirve casi tal cual (cambia `tipoDoc` y el
   catálogo de motivos pasa a ser el 10).
4. **PDF de NC usa la plantilla de factura** (`pdf/route.ts` línea ~10:
   "Reuse factura for nota_credito"). El cliente recibe un PDF que dice
   FACTURA. Necesita plantilla propia con el documento afectado visible.
5. **Sin reintentos**: `reintentarEnvio` del adapter solo soporta
   boleta/factura; una NC que falla por infraestructura muere ahí
   (y hoy hace rollback del correlativo aunque el fallo sea de red).
6. **Trazabilidad UI**: el comprobante original no muestra sus NC vinculadas
   (existe `comprobante_referencia_id` en BD pero la UI no lo usa).
7. **Doble NC**: se eliminó el check "ya existe NC emitida" que tenía el
   flujo viejo — hoy se pueden emitir dos NC totales del mismo comprobante.
   Regla correcta: bloquear si la suma de NC previas ≥ total del original.

### 1.2 Guías de Remisión Electrónica — NO EXISTE (0 líneas)

`grep -i "guia|remision|despatch|tipoDoc 09/31"` → **cero resultados**.
No hay tabla, ni mapper, ni UI, ni serie T001, ni credenciales GRE.

**Contexto normativo que condiciona el diseño (crítico, no opcional):**

- Desde 2023 la GRE remitente (tipo 09) es el único sustento de traslado
  (la guía física dejó de valer, RS 000123-2022/SUNAT y modificatorias).
- La GRE **NO viaja por el canal SOAP de CPE** que usamos para boletas:
  usa la **API REST de SUNAT** con OAuth2 (`client_id` + `client_secret`
  generados en el menú SOL), envío gzip+firma, **respuesta asíncrona por
  ticket** (enviar → recibir ticket → consultar estado → CDR).
- Greenter soporta este flujo (`Greenter\Api` / GreSender). **Hay que
  verificar si la versión de Lycet desplegada en Railway lo expone**
  (`/despatch/send`) y si acepta configurar client_id/secret por empresa.
  Este es el riesgo #1 del proyecto → se resuelve en la FASE 0 (spike).
- Exceptuados de datos de conductor/vehículo: traslados en vehículos
  categoría M1 o L (autos/motos) — exactamente la flota típica de nuestros
  clientes. El formulario debe reflejar esa excepción (checkbox "vehículo
  menor M1/L" que oculta conductor/placa y setea el indicador SUNAT).

**Datos que HOY faltan en nuestra BD para poder emitir una GRE:**

| Dato requerido por SUNAT | ¿Existe hoy? | Dónde vivirá |
|---|---|---|
| Ubigeo + dirección de partida (local) | ❌ (hay `direccion` texto en ferreterias, sin ubigeo) | `ferreterias.ubigeo_partida` + settings |
| Ubigeo + dirección de llegada (cliente) | ❌ (hay dirección texto/GPS en pedidos, sin ubigeo) | `guias_remision.ubigeo_llegada` (editable al emitir) |
| Peso bruto total (KGM) | ❌ (`productos` no tiene peso) | `productos.peso_kg` opcional + override al emitir |
| Placa del vehículo | ✅ `vehiculos.placa` | precarga desde la entrega asignada |
| Conductor (DNI, licencia, nombres) | ❌ (repartidores sin DNI/licencia) | `repartidores.dni`, `repartidores.licencia` (opcionales) |
| Serie de guías (T001) | ❌ | `sunat_series` tipo '09' |
| Credenciales API GRE (client_id/secret) | ❌ | `sunat_credenciales.gre_client_id_enc / gre_client_secret_enc` (AES-256-GCM) |
| Catálogo ubigeo (1,874 distritos) | ❌ | tabla `ubigeos` + seed |

---

## 2. ARQUITECTURA PROPUESTA (módulos, sin generalizar)

```
src/lib/facturacion/
├── catalogos-sunat.ts        ← NUEVO. Única fuente de catálogos: 09 (motivos NC),
│                                10 (motivos ND), 18 (modalidad transporte),
│                                20 (motivo traslado). UI y mappers leen de aquí.
├── sunat-directo-adapter.ts  ← se EXTIENDE: emitirNotaDebito() + reintento NC/ND
├── lycet/
│   ├── mappers.ts            ← se EXTIENDE: mapearNota acepta tipoDoc 07|08
│   └── mappers-gre.ts        ← NUEVO. mapearDespatch (modelo Greenter Despatch)
│   └── client.ts             ← se EXTIENDE: enviarDespatch + consultarTicketGre
└── …(todo lo demás intacto)

src/lib/guias/                ← NUEVO módulo autocontenido (patrón delivery/agenda)
├── types.ts                  ← GuiaRemision, EstadoGuia, DatosTraslado…
├── repository.ts             ← CRUD guias_remision, correlativo T001 vía sunat_series
├── service.ts                ← emitirGuia() / consultarEstado() / reintentar()
│                                (orquesta: validar → mapear → enviar → ticket → CDR)
└── pdf.tsx                   ← representación impresa GRE con QR oficial

src/components/guias/         ← NUEVO
├── GuiasTable.tsx            ← listado con estados en vivo
├── WizardGuia.tsx            ← wizard de emisión en 3 pasos (ver §5)
└── GuiaDetailSheet.tsx       ← detalle + ticket/CDR + PDF + reintento

src/components/comprobantes/
├── ModalNotaCredito.tsx      ← se COMPLETA (motivos, ítems por id, validaciones)
└── ModalNotaDebito.tsx       ← NUEVO (mismo esqueleto, catálogo 10)

src/components/pdf/
├── nota-credito/             ← NUEVO: PlantillaNCA4 + Ticket80 (doc afectado visible)
└── guia-remision/            ← NUEVO: PlantillaGuiaA4
```

**Decisión de datos**: las guías van en tabla propia **`guias_remision`**,
NO en `comprobantes`. Razones: ciclo de vida distinto (ticket asíncrono),
no afectan libros de ventas/IGV, y campos propios (traslado, transporte,
bultos, peso) que ensuciarían `comprobantes`. Se vinculan por
`pedido_id` / `entrega_id` / `comprobante_id` (la factura que sustentan).

---

## 3. FASES CON CHECKLIST

### ✅ FASE 0 — Spike de soporte GRE en Lycet — **CERRADA 2026-07-05**

- [x] Código fuente de `giansalex/lycet` (clonado en build, `master`) auditado
      vía GitHub API: **`DespatchController.php` existe** con rutas
      `/api/v1/despatch/{send,xml,pdf,status}`.
- [x] `ConfigurationController.php → PUT /company/{ruc}` **ya acepta**
      `CLIENT_ID`/`CLIENT_SECRET`/`GUIA_URL`/`AUTH_URL` por empresa — soporte
      multiempresa nativo, nada que tocar en el microservicio.
- [x] Confirmado en el código de `thegreenter/greenter`: boleta/factura/NC usan
      el canal SOAP clásico (`ConsultCdrServiceFactory`, Clave SOL + certificado);
      **Despatch usa un canal separado** (`SeeApiFactory` → `Greenter\Api` →
      `GreSender`) con OAuth2 (`client_id`/`client_secret`) — **son credenciales
      distintas**, confirmando el diseño original del plan (§2 tabla de datos).
- [x] Confirmado el flujo asíncrono por ticket en `GreSender::send()`
      (retorna `ticket`, código `98` = pendiente, `0`/`99` = resuelto con CDR).

**Decisión: (a) Lycet actual sirve tal cual.** Cero cambios al microservicio.
Se procede directo a FASE 1.

### ✅ FASE 1 — Notas de Crédito completas + Nota de Débito (1 día)

**BD / catálogos**
- [ ] `catalogos-sunat.ts` con catálogo 09 completo (13 motivos, con etiqueta
      corta + descripción larga + hint de cuándo usarlo) y catálogo 10 (ND:
      01 intereses por mora, 02 aumento en el valor, 03 penalidades).
- [ ] Migración: `comprobantes.tipo` acepta `nota_debito` (ya está en el tipo
      TS; verificar CHECK constraint en BD) + serie BD01/FD01 en `sunat_series`.

**Motor (adapter — cambios quirúrgicos, no reescritura)**
- [ ] `mapearNota` parametrizado: `tipoDoc: '07' | '08'`.
- [ ] `emitirNotaDebito()` en el adapter (calca de `emitirNotaCredito`,
      sin restauración de stock — una ND no devuelve mercadería).
- [ ] Guard anti-doble-NC: sumar NC emitidas del comprobante y bloquear si
      `suma_previa + nueva > total original` (error claro al usuario).
- [ ] Fix matching de ítems: por `items_pedido.id` (no `producto_id`).
- [ ] Clasificación reintentable para NC/ND: fallo de infraestructura NO hace
      rollback del correlativo; entra a la misma cola `facturacion-reintentos`
      (extender `reintentarEnvio` para tipo 07/08).

**UI/UX**
- [ ] `ModalNotaCredito`: selector de motivo con los 13 códigos agrupados
      (Anulación / Devolución / Descuentos / Ajustes), hint contextual bajo
      el selector, y comportamiento por motivo:
      - motivos de devolución (06/07) → muestra selector de ítems + stock,
      - motivos de ajuste (04/05/09/13) → muestra campo de monto directo,
      - anulaciones (01/02/03) → todo el comprobante, ítems bloqueados.
- [ ] `ModalNotaDebito` nuevo (catálogo 10, monto adicional + motivo).
- [ ] En `ComprobantesTable` y `OrderDetailPane`: chip "NC: FC01-00000003"
      en el comprobante original (usa `comprobante_referencia_id`) con link
      al PDF; y en la NC, chip "afecta a F001-00000012".
- [ ] Plantillas PDF propias: `PlantillaNCA4` y `PlantillaNCTicket80`
      (título NOTA DE CRÉDITO ELECTRÓNICA, bloque "Documento que modifica",
      motivo del catálogo, QR + hash — mismo sistema de branding/colores
      que boleta/factura).

**Verificación FASE 1 (checklist de salida)**
- [ ] `npm run build` limpio.
- [ ] NC total real aceptada por SUNAT (motivo 01) → estado, stock, PDF ok.
- [ ] NC parcial real (motivo 07, 1 de N ítems, ítem sin producto_id incluido).
- [ ] Intento de segunda NC total → bloqueado con mensaje claro.
- [ ] ND real (motivo 02) aceptada.
- [ ] PDF de NC ya no dice "FACTURA".

### ✅ FASE 2 — Fundamentos de datos para GRE (1 día)

- [ ] Migración `ubigeos`: tabla (codigo, departamento, provincia, distrito)
      + seed oficial INEI/SUNAT (~1,874 filas) + índice de búsqueda por texto.
- [ ] Migración datos GRE:
      - `ferreterias.ubigeo_partida`, `ferreterias.direccion_partida`
      - `productos.peso_kg NUMERIC NULL`
      - `repartidores.dni`, `repartidores.licencia` (NULL, opcionales)
      - `sunat_credenciales.gre_client_id_enc`, `gre_client_secret_enc`
      - `sunat_series` acepta tipo '09' (serie default T001)
- [ ] Tabla `guias_remision`: id, ferreteria_id, serie, numero, estado
      (`borrador → enviando → en_proceso(ticket) → aceptada | rechazada |
      error_reintentable`), ticket, cdr_codigo/descripcion, hash, qr_cadena,
      motivo_traslado (cat 20), modalidad (cat 18), fecha_traslado,
      peso_bruto_kg, bultos, vehiculo_placa, conductor_(dni/licencia/nombre),
      indicador_m1l BOOLEAN, partida_(ubigeo/direccion),
      llegada_(ubigeo/direccion), pedido_id, entrega_id, comprobante_id,
      items JSONB, xml_url, pdf_generado, created_at/updated_at + RLS tenant.
- [ ] Settings → Integraciones → SUNAT Directo: nueva sección "Guías de
      Remisión": credenciales GRE (cifradas AES-256-GCM, mismo `encryption.ts`),
      serie, dirección/ubigeo de partida con buscador de ubigeo. Guía paso a
      paso de cómo generar client_id/secret en SOL (mismo estilo que la guía
      del certificado).
- [ ] Catálogo → editor de producto: campo opcional "Peso (kg)".

**Verificación FASE 2**
- [ ] Buscador de ubigeo responde <100ms con texto parcial ("s j lurig…").
- [ ] Credenciales GRE guardadas cifradas (verificar en BD: prefijo AES, no plain).
- [ ] `npm run build` limpio. Nada del flujo actual de ventas se ve afectado.

### ✅ FASE 3 — Motor GRE (1–2 días, según resultado de FASE 0)

- [ ] `catalogos-sunat.ts`: catálogo 20 (motivos de traslado: 01 venta,
      02 compra, 04 traslado entre establecimientos, 08 importación,
      13 otros, etc.) y 18 (modalidad: 01 público, 02 privado).
- [ ] `lycet/mappers-gre.ts → mapearDespatch()`: modelo Greenter Despatch
      completo — envío (peso KGM, bultos, fecha traslado), traslado
      (motivo, modalidad, indicador M1/L), partida/llegada con ubigeo,
      transportista (si modalidad 01) o conductor+vehículo (si 02 y no M1/L),
      detalle de ítems (cantidad, unidad, descripción, código).
- [ ] `lycet/client.ts`: `enviarDespatch()` y `consultarTicketGre()`
      normalizados al mismo `ResultadoSunat` (+ campo ticket).
- [ ] `src/lib/guias/service.ts → emitirGuia()`:
      1. valida datos mínimos según modalidad/motivo (mensajes específicos,
         ej. "Falta el ubigeo de llegada"),
      2. reserva correlativo T001 (mismo `reservarCorrelativo`, tipo '09'),
      3. mapea + envía, guarda ticket → estado `en_proceso`,
      4. registra todo en `sunat_log` (categoría 'gre').
- [ ] Job Inngest `gre-tickets` (cada 5 min): consulta tickets `en_proceso`
      → resuelve a `aceptada` (guarda CDR, hash, QR) o `rechazada` (motivo)
      o reprograma. Reusa el patrón de `facturacion-reintentos`.
- [ ] Rutas API: `POST /api/guias` (emitir), `GET /api/guias` (listar),
      `GET /api/guias/[id]` (detalle+estado), `POST /api/guias/[id]/reintentar`,
      `GET /api/guias/[id]/pdf`.
- [ ] PDF `PlantillaGuiaA4`: formato oficial de representación impresa GRE
      (datos de traslado, tabla de bienes, QR obligatorio, leyenda).

**Verificación FASE 3**
- [ ] Guía real (o entorno de pruebas GRE) aceptada de punta a punta:
      emitir → ticket → job resuelve → CDR + QR guardados → PDF correcto.
- [ ] Rechazo simulado (ubigeo inválido) → estado `rechazada` con motivo legible.
- [ ] Caída de red simulada → `error_reintentable` → reintento automático.

### ✅ FASE 4 — UI/UX de Guías (1 día)

- [ ] Hub Facturación Electrónica: pestañas "Comprobantes | Guías de Remisión"
      (misma página, mismo lenguaje visual; badge con guías en proceso).
- [ ] `GuiasTable`: número, fecha traslado, destinatario, motivo, estado como
      chip semáforo (gris borrador / azul pulso en proceso / verde aceptada /
      rojo rechazada), acciones (PDF, reintentar, ver CDR). Estados en vivo
      vía Supabase Realtime (publicar `guias_remision`, mismo patrón que
      pedidos/comprobantes).
- [ ] `WizardGuia` (emisión) — 3 pasos, todo precargado cuando nace desde
      un pedido con entrega:
      1. **Traslado**: motivo (cat 20), fecha, ítems (del pedido, editables),
         peso calculado desde `peso_kg` con override manual, bultos.
      2. **Transporte**: modalidad; si privado → vehículo (dropdown de
         `vehiculos` del negocio) + toggle "vehículo menor (M1/L)" que
         explica y oculta conductor/placa; si conductor requerido → dropdown
         de repartidores (usa dni/licencia guardados, pide completar si faltan).
      3. **Ruta y confirmación**: partida (default del settings, editable),
         llegada (dirección del pedido + buscador de ubigeo), resumen completo
         y botón "Emitir Guía".
      - Validación por paso (no se avanza con datos incompletos), errores
        inline junto al campo, nunca alert genérico.
- [ ] Puntos de entrada:
      - `OrderDetailPane` (pedido delivery): botón "Generar Guía de Remisión"
        (visible si facturación activa y modalidad delivery).
      - Detalle de entrega en el centro de operaciones: mismo botón cuando
        hay vehículo asignado (precarga placa/repartidor).
- [ ] Mobile-first: wizard usable a 375px (pasos apilados, botonera sticky).

**Verificación FASE 4**
- [ ] Emitir guía desde un pedido delivery real en <60 segundos con solo
      confirmar datos precargados.
- [ ] Flujo M1/L (moto): sin pedir conductor ni placa de camión.
- [ ] Estado pasa de "en proceso" a "aceptada" en la tabla sin recargar.

### ✅ FASE 5 — Integración con delivery + bot (½ día)

- [ ] Al marcar "En camino" una entrega sin guía emitida (y con facturación
      activa): aviso no bloqueante en el panel con acción "Generar guía ahora".
- [ ] `OrdersInboxList`: indicador 📄 en pedidos delivery con guía aceptada.
- [ ] (Opcional, flag apagado por defecto) tool del bot `consultar_guia`:
      el cliente puede pedir su guía por WhatsApp → envía el PDF.

### ✅ FASE 6 — Cierre (½ día)

- [ ] `npm run build` limpio + `grep` de TODOs del plan = 0.
- [ ] Prueba integral en producción con el tenant real: venta POS → factura
      → guía de remisión → NC parcial de esa factura. Los 4 documentos
      aceptados por SUNAT y visibles en el hub con sus PDFs.
- [ ] Salud Fiscal: sumar tarjeta "Guías en proceso / rechazadas".
- [ ] Actualizar CLAUDE.md (módulo guías) y este doc con estado FINAL.
- [ ] Commit por fase (6 commits, no uno gigante) + deploy + verificación.

---

## 4. REGLAS PARA NO CONFUNDIRNOS (aplican a todas las fases)

1. **Una fase = un commit = un checklist cerrado.** No se empieza la
   siguiente con checkboxes abiertos de la anterior.
2. **El motor de boletas/facturas es intocable** salvo los puntos de
   extensión listados. Cualquier cambio fuera de eso se consulta primero.
3. **Catálogos SUNAT viven en un solo archivo** (`catalogos-sunat.ts`).
   Prohibido duplicar arrays de motivos en componentes.
4. **Todo secreto nuevo se cifra** con `encryption.ts` (AES-256-GCM).
   Nada de `plain:`.
5. **Correlativos siempre vía `reservarCorrelativo`** (reserva atómica) —
   nunca `MAX(numero)+1`.
6. **Toda emisión escribe en `sunat_log`** — sin bitácora no hay debugging.
7. **Verificación = emisión real aceptada por SUNAT**, no "compila".
