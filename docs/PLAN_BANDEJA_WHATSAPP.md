# Plan: Plataforma WhatsApp + CRM — Bandeja Potenciada (multi-rubro)

> Plataforma de comunicación y CRM para **cualquier tipo de negocio** via WhatsApp.
> No se toca nada de la configuración del bot (perfil, agentes, comportamiento,
> complementarios, prompt, asistente IA). Todo lo de abajo es la **bandeja de atención
> y herramientas de marketing**. Código interno: FerroBot. Frontend: "negocio", nunca
> "ferretería".

Ambición: lo que hace Respond.io / Wati / Zoko — integrado al bot multi-agéntico,
POS, delivery y facturación que ya existen.

---

## ⚠️ Lo que YA EXISTE — no tocar ni duplicar

| Dónde | Qué hay |
|---|---|
| Bot → Perfil | Nombre del bot, tipo de negocio, tono, descripción, instrucciones extra |
| Bot → Agentes | Multi-agente con toggles por agente/herramienta, instrucciones por agente |
| Bot → Comportamiento | Debounce, delay, timeout dueño, timeout sesión, umbral monto |
| Bot → Complementarios | Pares de productos para upsell automático |
| Bot → Prompt | Prompt raw editable |
| Bot → Asistente IA | Asistente IA interno |
| `bot_pausado` + motivo + timer | Toggle por chat ya existe en ConversationsList y ChatView |
| Realtime (Supabase) | Ya empuja mensajes y cambios de conversación en vivo |
| `ycloud_status` (sent/delivered/read) | Ya trackeado en `mensajes` |
| Webhook Meta+YCloud+WASender | Drivers funcionando y abstracción multi-proveedor |
| Agente "pagos" → recordatorios deuda | Recordatorios automáticos de crédito vencido |
| Agente "comunicaciones" | Telegram, email, etc. ya conectados por los agentes |
| Agente "agenda" | Citas/reservas → manejado por el multi-agente, NO se duplica |

---

## 🔑 Cambios de lenguaje frontend (transversal a todo)

Cualquier string visible al usuario que diga "ferretería" pasa a decir **"negocio"**.
Se hace de forma incremental conforme se tocan los archivos en cada fase, sin un
pase global que rompa cosas. Solo frontend — nunca nombres de tabla/variable.

---

## 🧩 MÓDULOS A CONSTRUIR

### M1 · Inbox potenciado
- **No-leídos:** punto/badge por chat + contador global arriba (sin leer / esperándote / con bot).
- **Estados de conversación:** Abierta / Pendiente / Esperando cliente / Resuelta.
  Marcar como resuelta cierra el chat de la vista principal (no lo borra).
- **Snooze (posponer):** ocultar un chat hasta una hora específica; reaparece solo.
- **Fijar (pin):** anclar chats importantes al tope.
- **Archivar:** sacar de la vista principal; accesible desde filtro "Archivados".
- **Búsqueda global en mensajes** (no solo nombre/teléfono).
- Vista previa de media en lista (📷 imagen, 📄 doc, 🎤 audio transcrito).
- Contadores "Mis chats" / "Sin asignar" cuando hay equipo.

### M2 · Chat potenciado (dentro de cada conversación)
- **Adjuntos:** enviar foto/imagen, PDF, ubicación desde el dashboard (usando `WASender`
  que ya tiene `enviarImagen` y `enviarDocumento`).
- **Render de media recibida:** preview de imagen, chip de PDF descargable, duración de audio.
- **Citar/responder** un mensaje específico (reply en hilo).
- **Reacciones:** emoji a mensajes (Meta/YCloud soportan esto).
- **Respuestas rápidas:** "/" despliega plantillas de texto cortas guardadas por el negocio
  con variables (`{nombre}`, `{numero}`). Se insertan con 1 clic.
- **Notas internas:** toggle en el input; se guardan `es_nota_interna=true`, jamás se
  envían al proveedor, con estilo visual diferente (fondo amarillo, 🔒).
- **@menciones** a compañeros del equipo en notas internas.
- Botones de acción rápida en header: "Crear pedido", "Ver ficha de cliente".

### M3 · Switch maestro del bot + horario
- **Switch maestro `bot_global_activo`:** apaga el bot para TODOS los chats del negocio
  de golpe. El switch por chat (ya existe) sigue funcionando como override individual.
- **Horario de atención:** configurable (días y horas). Fuera de horario el bot puede:
  enviar mensaje de ausencia / seguir respondiendo / redirigir. (Distinto del
  `timeout_sesion_minutos` que ya existe en Comportamiento — ese es otra cosa.)
- **Mensajes automáticos:** bienvenida (primer mensaje del cliente), ausencia fuera de
  horario, vuelta ("¡Ya estamos de vuelta!"). Editor simple de texto con variables.
- Nota: las *reglas de derivación* (handoff por palabra clave) ya las maneja el agente
  de `ia_escalation` vía el intent `pedir_humano`. No duplicar.

### M4 · Contactos y CRM
- **Ficha de contacto enriquecida:** campos genéricos editables por el negocio
  (`campos_extra JSONB`). Ej: clínica → "último tratamiento"; inmobiliaria → "zona".
  El tipo de negocio configurado en Bot → Perfil puede sugerir campos comunes.
- **Pipeline / embudo:** etapas configurables por el dueño (Nuevo → Interesado → Cliente
  → Recurrente, o las que quiera). Vista Kanban de contactos.
- **Segmentos dinámicos:** listas auto-actualizadas por etiqueta o comportamiento
  ("contactos sin compras en 30 días").
- **Importar/exportar CSV** de contactos + **deduplicación/merge** por teléfono.
- **Línea de tiempo** por contacto: mensajes, pedidos, campañas recibidas, notas.
- `acepta_marketing` (opt-in/opt-out) por contacto — crítico para campañas.

### M5 · Etiquetas y organización
- El dueño crea etiquetas con nombre y color (ej. 🔴 Urgente, 🟢 VIP, 🔵 Cotización).
- Asignar/quitar etiquetas a chats y contactos; filtros en la bandeja.
- **Etiquetado automático básico:** si el mensaje contiene cierta palabra clave →
  añadir etiqueta automáticamente.

### M6 · Equipo y multi-agente humano
- **Asignar** chats a un miembro del equipo; vista "Mis chats".
- **Enrutamiento automático:** round-robin, por disponibilidad, o por etiqueta.
- Estado del agente: disponible / ausente (afecta el enrutamiento).
- **SLA:** alerta si un chat asignado no tiene respuesta en X minutos.
- **Chat interno** sobre una conversación: comentarios del equipo que el cliente no ve
  (comparte tabla con notas internas pero con `tipo='equipo'`).

### M7 · Plantillas HSM (constructor visual)
Meta **obliga** plantillas aprobadas para escribir a clientes fuera de la ventana de 24h.
- **Editor visual:** texto con variables `{1}` o `{nombre}`, botones de CTA/respuesta,
  encabezado (texto o imagen), pie de página. Vista previa en tiempo real estilo burbuja.
- Categorías (utility / marketing / authentication), idioma.
- **Envío a Meta para aprobación** desde la UI con un clic.
- **Estado sincronizado:** ⏳ En revisión / ✅ Aprobada / ❌ Rechazada.
- YCloud también soporta templates — el driver ya tiene `enviarTemplate`.
  Se extiende con `crearPlantilla()` en el driver Meta.
- Biblioteca de plantillas reutilizables del negocio.

### M8 · Campañas y difusiones masivas
- **Wizard paso a paso:** 1. Elige plantilla aprobada → 2. Elige segmento (etiqueta /
  todos / búsqueda manual) → 3. Vista previa → 4. Enviar ahora o programar.
- **Programación** con hora exacta (zona America/Lima).
- **Encolado por lotes** respetando los límites de Meta (máx envíos/día según calidad
  del número de WhatsApp). El sistema pausa y reanuda el envío automáticamente.
- **Tracking completo:** enviados / entregados / leídos / respondidos por campaña.
- **Opt-out respetado:** excluye automáticamente contactos con `acepta_marketing=false`.
- Lista de bloqueados por el cliente (responde STOP/No gracias → auto-opt-out).

### M9 · Notificaciones (in-app + push móvil)
- **In-app:** campanita en el header con badge de no-leídos total + lista desplegable
  de chats con mensajes recientes. Sonido configurable al recibir mensaje.
- **Alerta de handoff:** cuando un cliente escribe "hablar con persona" o el bot escala
  (intent `pedir_humano`) → notificación destacada con sonido diferente.
- **Push web (PWA/Web Push API):** notificaciones al celular incluso con la app cerrada.
  El dueño activa el permiso una sola vez. Funciona en Android Chrome y iOS Safari 16+.
- **SLA:** alerta si un chat lleva más de N minutos sin respuesta (configurable).
- Opcional: el agente de comunicaciones ya maneja Telegram/email como canal de aviso.

### M10 · Analítica y reportes
- **Resumen de bandeja:** conversaciones abiertas, tiempo promedio de primera respuesta,
  tiempo de resolución, satisfacción (si se pregunta por CSAT básico).
- **Desempeño por agente/miembro:** chats atendidos, tiempo de respuesta, resueltos.
- **Campañas:** alcance, tasa de lectura, tasa de respuesta, opt-outs por campaña.
- **Embudo CRM:** cuántos contactos hay en cada etapa del pipeline.
- **Exportable** (CSV / descarga de tabla).

### M11 · Seguridad, privacidad y cumplimiento
- **Permisos por rol:** qué miembro del equipo ve qué chats (solo asignados / todos),
  editable por el dueño. Se apoya en `miembros_ferreteria.permisos` JSONB existente.
- **Auditoría ligera:** quién abrió/respondió/exportó/difundió, con timestamp. Tabla
  `conversaciones_audit` por tenant.
- **Privacidad de datos:** opt-in/opt-out de marketing (`acepta_marketing`),
  **enmascarado opcional de teléfono** para miembros (ven `+51 *** ***567`),
  **política de retención:** purgar mensajes > N meses (configurable por dueño).
- **Lista negra:** bloquear números que no deben interactuar con el bot/bandeja.
- Panel de privacidad en Configuración, sección propia.

---

## 🗂️ FASES Y CHECKLIST — orden por valor/riesgo

### FASE 0 — Cimientos de datos (1 migración limpia)
- [ ] **0.1** `supabase/migrations/089_bandeja_crm.sql`:
  - `conversaciones`: `no_leido_count INT DEFAULT 0`, `estado_atencion TEXT DEFAULT 'abierta'`
    CHECK('abierta','pendiente','esperando','resuelta'), `archivada BOOL DEFAULT false`,
    `fijada BOOL DEFAULT false`, `snooze_hasta TIMESTAMPTZ`, `asignado_a UUID NULL`
    (FK `auth.users`), `ultima_lectura_at TIMESTAMPTZ`.
  - `mensajes`: `media_url TEXT`, `media_tipo TEXT`, `es_nota_interna BOOL DEFAULT false`,
    `responde_a UUID` (FK self), `tipo_nota TEXT DEFAULT 'interna'`
    CHECK('interna','equipo'), `reaccion TEXT`.
  - Nueva `etiquetas` (id UUID PK, ferreteria_id, nombre, color, created_at).
  - Nueva `conversacion_etiquetas` (conversacion_id, etiqueta_id — PK compuesta, N:N).
  - Nueva `respuestas_rapidas` (id, ferreteria_id, atajo, contenido, variables JSONB,
    created_at).
  - Nueva `plantillas_wa` (id, ferreteria_id, nombre, categoria, idioma, cuerpo TEXT,
    variables JSONB, tiene_botones BOOL, estado_aprobacion TEXT DEFAULT 'borrador'
    CHECK('borrador','pendiente','aprobada','rechazada'), proveedor_template_id TEXT,
    motivo_rechazo TEXT, created_at, updated_at).
  - Nueva `campanas` (id, ferreteria_id, nombre, plantilla_id FK, segmento JSONB,
    estado TEXT DEFAULT 'borrador' CHECK('borrador','programada','enviando','completada',
    'pausada'), programada_at TIMESTAMPTZ, total INT DEFAULT 0, enviados INT DEFAULT 0,
    entregados INT DEFAULT 0, leidos INT DEFAULT 0, respondidos INT DEFAULT 0,
    created_at).
  - Nueva `campana_destinatarios` (id, campana_id FK, cliente_id FK, telefono TEXT NOT NULL,
    estado TEXT DEFAULT 'pendiente' CHECK('pendiente','enviado','entregado','leido',
    'respondido','error','optout'), wamid TEXT, error TEXT, enviado_at TIMESTAMPTZ).
  - Nueva `pipelines` (id, ferreteria_id, nombre, etapas JSONB, created_at).
  - `clientes`: `+ acepta_marketing BOOL NOT NULL DEFAULT true`,
    `+ etapa_pipeline TEXT`, `+ campos_extra JSONB DEFAULT '{}'`.
  - `ferreterias`: `+ bot_global_activo BOOL NOT NULL DEFAULT true`,
    `+ horario_atencion JSONB`, `+ mensajes_auto JSONB`.
  - Nueva `conversaciones_audit` (id, ferreteria_id, conversacion_id, usuario_id,
    accion TEXT, detalle JSONB, created_at).
  - Índices clave: `conversaciones(ferreteria_id, archivada, fijada, ultima_actividad)`,
    `conversaciones(ferreteria_id, estado_atencion)`,
    `conversaciones(asignado_a)`,
    `conversacion_etiquetas(etiqueta_id)`,
    `campana_destinatarios(campana_id, estado)`,
    `clientes(ferreteria_id, acepta_marketing)`.
  - RLS: todas con `mi_ferreteria_id()`; `campanas`/`plantillas_wa` solo `dueno`.
- [ ] **0.2** Extender `src/types/database.ts`: `Conversacion`, `Mensaje` + nuevas
  interfaces (`Etiqueta`, `RespuestaRapida`, `PlantillaWA`, `Campana`, `Pipeline`, etc.).
- [ ] **0.3** Aplicar migración a Supabase.

### FASE 1 — Inbox base: no-leídos + estados + fijar/archivar/snooze (M1)
- [ ] Webhook entrante: al guardar mensaje cliente → `no_leido_count++`.
- [ ] Al abrir chat `[id]`: `no_leido_count=0`, `ultima_lectura_at=now()` + `marcarLeido`.
- [ ] `ConversationsList`: punto/badge por chat, negrita si no-leídos, contadores arriba.
- [ ] Filtros nuevos: estado_atencion, archivados, fijados, mis chats.
- [ ] Menú "…" por chat: archivar, fijar, snooze (picker de hora), marcar resuelta.
- [ ] Búsqueda full-text en mensajes (API + index DB).

### FASE 2 — Chat potenciado: adjuntos + respuestas rápidas + notas (M2)
- [ ] Input de adjunto (foto/PDF): subir a Supabase Storage → `sender.enviarImagen/enviarDocumento`.
- [ ] Render de media en burbujas: preview imagen, chip PDF, badge audio.
- [ ] CRUD respuestas rápidas (API + UI en settings). "/" en ChatView filtra y despliega.
- [ ] Notas internas: toggle en input, estilo amarillo, NO se envían.
- [ ] Citar mensaje: botón reply en burbuja → input con cita, se manda el texto normal
  (WhatsApp renderiza la cita nativo si se estructura bien).

### FASE 3 — Etiquetas + switch maestro + horario (M3 + M5)
- [ ] CRUD etiquetas (color picker + nombre). API + UI en sidebar derecho del chat.
- [ ] Asignar/quitar etiquetas a conversaciones. Chips en lista.
- [ ] Filtro por etiqueta en la bandeja.
- [ ] Etiquetado automático por palabra clave (regla simple: si mensaje contiene X → etiqueta Y).
- [ ] `bot_global_activo` en `ferreterias` + leer en `message-handler`.
- [ ] Switch maestro: componente en header de la bandeja con confirmación.
- [ ] Horario de atención + mensajes automáticos (bienvenida/ausencia): UI en
  Configuración → Bot (nueva sub-sección "Horario y mensajes automáticos").

### FASE 4 — Contactos CRM + pipeline (M4)
- [ ] Ficha de contacto: campos genéricos editables (`campos_extra`), línea de tiempo.
- [ ] Campos sugeridos según `tipo_negocio` de Bot → Perfil.
- [ ] Pipeline Kanban configurable por el dueño: etapas + arrastrar contactos.
- [ ] Segmentos dinámicos (consultas guardadas).
- [ ] Import CSV (parse + dedup por teléfono) + export CSV.
- [ ] `acepta_marketing` editable desde la ficha + manejo de opt-out automático (respuesta "STOP").

### FASE 5 — Equipo: asignación + multi-agente humano (M6)
- [ ] Asignar conversación a un miembro. "Mis chats" como filtro de bandeja.
- [ ] Enrutamiento round-robin al llegar conversación nueva sin asignar.
- [ ] Estado del agente (disponible/ausente) — simple toggle en la UI.
- [ ] SLA: cron/trigger que alerta si chat asignado no tiene respuesta en N min (configurable).
- [ ] Chat interno de equipo sobre conversación (tipo_nota='equipo').

### FASE 6 — Plantillas HSM (M7)
- [ ] Constructor visual: editor con variables `{nombre}`, vista previa burbuja en vivo.
- [ ] Soporte de botones (CTA / respuesta rápida) y encabezado texto o imagen.
- [ ] API `/api/whatsapp/plantillas`: POST (crea local + envía a Meta Graph API
  `/{waba_id}/message_templates`), GET (lista + sync estado), DELETE.
- [ ] Webhook Meta `message_template_status_update` → actualizar `estado_aprobacion`.
- [ ] Extender driver Meta: `crearPlantilla()`, `listarPlantillas()`.
- [ ] Biblioteca de plantillas con estado visual (⏳/✅/❌).

### FASE 7 — Campañas y difusiones (M8)
- [ ] Wizard: plantilla aprobada → segmento → vista previa personalizada → enviar/programar.
- [ ] Encolado: lotes de 50, delay entre lotes según límite de Meta; cron que ejecuta.
- [ ] Tracking: actualizar `campana_destinatarios.estado` con webhooks de status.
- [ ] Tablero de resultados por campaña (gráfica simple: barra enviados/entregados/leídos).
- [ ] Opt-out automático: si cliente responde "STOP" / "No gracias" → `acepta_marketing=false`.

### FASE 8 — Notificaciones (M9): in-app + push móvil
- [ ] In-app: campanita en navbar con badge de no-leídos total. Lista desplegable de
  chats pendientes con último mensaje.
- [ ] Sonido al recibir mensaje nuevo (archivo de audio ligero, configurable on/off).
- [ ] Alerta diferenciada para handoff (`pedir_humano`) — sonido distinto + banner rojo.
- [ ] **Web Push API (PWA):** service worker + suscripción push. Al llegar mensaje nuevo
  → push notification al móvil aunque la app esté cerrada. Compatibilidad: Android
  Chrome + iOS Safari 16.4+.
  - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` en env vars.
  - Tabla `push_subscriptions` (usuario_id, endpoint, keys, created_at).
  - API `/api/push/subscribe` (guardar suscripción) y trigger en webhook entrante.
- [ ] SLA: alerta si chat sin respuesta > N min (via cron o trigger DB).

### FASE 9 — Analítica (M10)
- [ ] Dashboard de bandeja: conversaciones abiertas/resueltas, TFR (tiempo primera
  respuesta promedio), tiempo de resolución.
- [ ] Tabla de desempeño por agente (chats, tiempo, resueltos).
- [ ] Resultados de campañas (tabla + gráfica básica).
- [ ] Embudo CRM (count por etapa pipeline).
- [ ] Exportar tabla como CSV.

### FASE 10 — Seguridad y privacidad (M11)
- [ ] Permisos: qué miembro ve qué chats (solo asignados / todos), editable por dueño.
  Extender `miembros_ferreteria.permisos JSONB`.
- [ ] Auditoría: loguear apertura/respuesta/exportación/difusión en `conversaciones_audit`.
- [ ] Enmascarado de teléfono para miembros sin permiso completo.
- [ ] Retención de mensajes: cron de purga configurable (> N meses).
- [ ] Lista negra de números (bloqueo en webhook: si el número está bloqueado, ignorar).
- [ ] Panel UI en Configuración → sección "Privacidad y cumplimiento".

### FASE 11 — Cierre y deploy
- [ ] `npm run build` limpio.
- [ ] Verificación runtime end-to-end en preview/local (no tests).
- [ ] Commit + push + verificar deploy Vercel.

---

## 🔌 Reutilización (nada se reinventa)
- `WASender` + drivers Meta/YCloud — enviarMensaje/Imagen/Documento/Template/Botones.
- Supabase Realtime — mensajes y cambios de conversación ya en vivo.
- `bot_pausado` por chat — ya existe; se le suma el `bot_global_activo` maestro.
- `ycloud_status` (sent/delivered/read) — ya trackeado; base para campañas.
- `src/lib/notifications` — canal Telegram/email existente para alertas SLA.
- `miembros_ferreteria.permisos` — base para permisos de equipo.
- `clientes` ya existente — se enriquece, no se reemplaza.
- Bot → Agentes (ventas/crm/agenda/pagos/comunicaciones) — intocable.
