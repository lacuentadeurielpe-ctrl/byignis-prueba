# Plan: Agentes con herramientas activables + integraciones + branding

> Objetivo: convertir los "agentes" (hoy grupos rígidos de tools) en **contenedores de
> herramientas desplegables y activables una por una**, con un registro data-driven que
> conecta UI ↔ orquestador ↔ integraciones ↔ prompt. Cada herramienta que necesite
> credenciales muestra un aviso con enlace a Integraciones, y los PDF (boleta / cotización
> / nota de venta) se personalizan con el logo y color del negocio.

---

## 0. Estado actual (verificado en código)

- **Agentes = filtro de tools todo-o-nada.** `AGENT_TOOLS` en `src/lib/ai/tools/index.ts:349`
  mapea 4 agentes → tools. `getActiveToolSchemas()` quita las tools de los agentes apagados.
- **Orquestador único y síncrono** dentro del webhook WhatsApp (`orchestrator.ts`),
  tope ~28s / 8 iteraciones / 9s por tool (límite Vercel 60s).
- **Almacenamiento:** `ferreterias.bot_agentes_activos: string[]` (qué agentes ON).
  UI `BotAgentesTab.tsx` hardcodea 4 agentes; route `api/settings-2/bot/agentes` lee/escribe.
- **13 tools existentes:** `buscar_producto`, `guardar_cotizacion`, `crear_pedido`,
  `obtener_stock`, `consultar_pedido`, `info_ferreteria`, `agregar_a_pedido_reciente`,
  `sugerir_complementario`, `historial_cliente`, `guardar_dato_cliente`, `escalar_humano`,
  `solicitar_comprobante`, `modificar_pedido`.
  - Núcleo (siempre ON, sin agente): `buscar_producto`, `obtener_stock`, `consultar_pedido`,
    `info_ferreteria`, `escalar_humano`.
- **PDF:** `src/lib/pdf/generar-comprobante.ts` ya genera boleta/factura **y ya usa
  `logo_url` + `color_comprobante`** (líneas 117-118). NO existe PDF de cotización/proforma
  (no pagada) — `guardar_cotizacion` solo guarda en BD y devuelve texto.
- **Branding:** `ferreterias.logo_url` y `ferreterias.color_comprobante` (hex, default
  `#1e40af`) ya existen (`database.ts:118-119`).
- **Integraciones:** tabla `integraciones_conectadas (tipo, estado, conectado_at, metadata jsonb)`
  + `integracion_logs`, UNIQUE(ferreteria_id, tipo). UI `integraciones/page.tsx` lista tarjetas
  estáticas; cada integración tiene su página `/integraciones/{tipo}`.
- **Prompt:** `orchestrator-prompt.ts` arma un system prompt con `PROMPT_SECTIONS` (5 secciones),
  editables por sección vía `prompt_overrides` en la pestaña Prompt.

---

## 1. Arquitectura objetivo

### 1.1. Registro de agentes (única fuente de verdad)
Nuevo: `src/lib/ai/agents/registry.ts`

```ts
type IntegracionTipo = 'gmail' | 'telegram' | 'drive' | 'calendar' | 'nubefact' | 'mercadopago'

interface ToolDef {
  name: string                      // coincide con TOOL_SCHEMAS + TOOL_EXECUTORS
  label: string                     // UI
  desc: string                      // UI
  nucleo?: boolean                  // siempre ON, no se puede apagar
  requiereIntegracion?: IntegracionTipo   // gating: si no está conectada → tool oculta al LLM
  promptSectionKey?: PromptSectionKey     // guía de prompt que aporta (opcional)
}

interface AgentDef {
  id: string                        // 'ventas' | 'comprobantes' | ...
  label: string
  desc: string
  accent: string                    // color del acordeón en UI
  tools: ToolDef[]
}

export const AGENT_REGISTRY: AgentDef[] = [ ... ]
```

Reemplaza el `AGENT_TOOLS` hardcodeado. **Todo lo lee de aquí**: UI, orquestador, integraciones, prompt.

### 1.2. Gating de tools (sin romper nada)
`getActiveToolSchemas(agentesActivos, herramientasDesactivadas, integracionesConectadas)`:

Una tool entra al toolset del LLM si:
1. es **núcleo**, O
2. su **agente está activo** Y no está en `herramientasDesactivadas` Y
   (no tiene `requiereIntegracion` O esa integración está `conectado`).

→ Semántica **opt-out**: ausente = activo. Tenants actuales no cambian.
→ Si falta la integración, la tool simplemente no existe para el LLM → **nunca rompe en runtime**.

### 1.3. Almacenamiento
- Mantener `ferreterias.bot_agentes_activos: string[]` (compat).
- **Nueva columna** `ferreterias.bot_herramientas_desactivadas: text[]` (default `{}`) —
  lista de tools apagadas explícitamente.
- Integraciones nuevas → filas en `integraciones_conectadas` con `tipo` =
  `'telegram' | 'gmail' | 'drive' | 'calendar'`.

---

## 2. Fases y checklist

### FASE 0 — Motor (sin cambios visibles; todo sigue igual)
- [ ] Migración `071_agentes_herramientas.sql`: `ALTER TABLE ferreterias ADD COLUMN
      bot_herramientas_desactivadas text[] NOT NULL DEFAULT '{}'`.
- [ ] `src/lib/ai/agents/registry.ts`: definir `AGENT_REGISTRY` con los 4 agentes + sus tools
      actuales + tools núcleo. 1 sola fuente de verdad.
- [ ] Refactor `getActiveToolSchemas()` en `tools/index.ts` para leer del registro y aceptar
      `(agentesActivos, herramientasDesactivadas, integracionesConectadas)`.
- [ ] `message-handler.ts`: cargar `bot_herramientas_desactivadas` + integraciones conectadas
      y pasarlas al orquestador. Verificar que `agentesActivos` sigue resolviéndose igual.
- [ ] `npm run build` limpio. Comportamiento idéntico (nada apagado por default).

### FASE 1 — UI acordeón con toggles por herramienta
- [ ] API `GET/PATCH /api/settings-2/bot/agentes`: extender para devolver/guardar también
      `herramientas_desactivadas` y exponer el `AGENT_REGISTRY` (o un endpoint que lo sirva).
- [ ] `BotAgentesTab.tsx`: reescribir como **acordeón**.
      - Fila de agente: toggle maestro + chevron + color de acento.
      - Desplegado: a la derecha, en otro color, lista de herramientas con switch individual.
      - Agente OFF → sus herramientas en gris (deshabilitadas).
- [ ] Aviso de integración: si una tool tiene `requiereIntegracion` no conectada y el usuario
      la enciende → badge "Requiere {Gmail}" + **aviso inline con enlace** a
      `/dashboard/settings-2/integraciones/{tipo}`. La intención se guarda; la tool queda
      "pendiente" hasta conectar.
- [ ] `npm run build` + revisar en preview.

### FASE 2 — Herramientas de PDF con branding (sin integración nueva)
- [ ] Verificar/añadir en Negocio (`GeneralForm.tsx`): **subir logo** (a `logo_url`) +
      **color picker** (a `color_comprobante`). Si ya existe, solo confirmar.
- [ ] Nueva tool `generar_cotizacion_pdf`: proforma/cotización (no pagada) en PDF, reusa
      `logo_url` + `color_comprobante`, la envía por WhatsApp. (Plantilla del patrón
      "derivar": el agente la invoca; la tool maqueta y renderiza con `@react-pdf/renderer`.)
- [ ] (Opcional) `generar_nota_venta_pdf` con el mismo branding.
- [ ] Registrar ambas en `AGENT_REGISTRY` bajo el agente Ventas/Comprobantes.
- [ ] Sección de prompt que explique cuándo usarlas (ver Fase 5).
- [ ] `npm run build` + probar flujo: cliente pide cotización → llega PDF branded.

### FASE 3 — Infraestructura de integraciones nuevas
- [ ] `integraciones/page.tsx`: mover Telegram/Gmail/Drive/Calendar de "Próximamente" a
      activas, con su tarjeta + `href` a su config.
- [ ] **Telegram** (más simple, sin OAuth): página `/integraciones/telegram` — pegar token de
      bot + chat_id → guardar en `integraciones_conectadas.metadata`, estado `conectado`.
- [ ] **Email** (Resend, API key — sin OAuth, primer paso simple): página
      `/integraciones/gmail` (o "email") — guardar API key + remitente.
- [ ] **Google OAuth** (Gmail real / Drive / Calendar): ruta callback OAuth, guardar tokens
      cifrados en `metadata`, manejo de refresh. (Más pesado; va al final.)
- [ ] Cada conexión escribe `integraciones_conectadas` + `integracion_logs`. Estado leído por
      el registro (gating) y por los setup-checks existentes.
- [ ] `npm run build`.

### FASE 4 — Herramientas que usan las integraciones
- [ ] `notificar_telegram`: avisa al dueño (nuevo pedido, escalamiento). `requiereIntegracion: 'telegram'`.
- [ ] `enviar_por_gmail`: manda cotización/boleta por correo. `requiereIntegracion: 'gmail'`.
      Guardrail: solo a direcciones que **el propio cliente** dio en la conversación;
      nunca a direcciones venidas de resultados de tools; rate-limit.
- [ ] `subir_a_drive`: guarda el PDF en Drive del negocio. `requiereIntegracion: 'drive'`.
- [ ] `agendar_visita`: crea evento/reunión (visita técnica, recojo). `requiereIntegracion: 'calendar'`.
- [ ] Registrar todas en `AGENT_REGISTRY` (posible agente nuevo "Comunicaciones" / "Agenda").
- [ ] Executors en `TOOL_EXECUTORS` + schemas en `TOOL_SCHEMAS`. Respetar timeout 9s.
- [ ] `npm run build`.

### FASE 5 — Prompt conectado a las herramientas
- [ ] Extender `PromptSectionKey` + `PROMPT_SECTIONS` con secciones para las tools nuevas.
- [ ] `buildOrchestratorSystemPrompt`: incluir condicionalmente la guía de una tool **solo si
      está activa** (lee estado de agentes/herramientas/integraciones).
- [ ] `BotPromptTab.tsx`: que las nuevas secciones aparezcan editables en la pestaña Prompt.
- [ ] `npm run build`.

### FASE 6 — Cierre
- [ ] Trazado punta a punta: encender/apagar una tool en UI → se refleja en el toolset del LLM.
- [ ] Tool con integración OFF → no aparece al LLM, aviso+enlace correcto en UI.
- [ ] PDF cotización/nota → branding correcto (logo + color).
- [ ] `npm run build` final → commit por fase → push → verificar deploy Vercel.

---

## 3. Mapa de archivos

**Nuevos**
- `supabase/migrations/071_agentes_herramientas.sql`
- `src/lib/ai/agents/registry.ts`
- `src/lib/pdf/generar-cotizacion.ts` (+ nota de venta)
- `src/lib/integraciones/{telegram,email,google}.ts` (clientes de cada servicio)
- `src/app/(dashboard)/dashboard/settings-2/integraciones/{telegram,gmail,drive,calendar}/page.tsx`
- `src/app/api/integraciones/{tipo}/route.ts` + callback OAuth donde aplique

**Modificados**
- `src/lib/ai/tools/index.ts` (registro + `getActiveToolSchemas` + nuevos schemas/executors)
- `src/lib/bot/message-handler.ts` (cargar herramientas desactivadas + integraciones)
- `src/lib/ai/orchestrator-prompt.ts` (secciones condicionales por tool)
- `src/types/database.ts` (`bot_herramientas_desactivadas`, tipos de integración)
- `src/app/(dashboard)/dashboard/settings-2/bot/components/BotAgentesTab.tsx` (acordeón)
- `src/app/(dashboard)/dashboard/settings-2/bot/components/BotPromptTab.tsx` (nuevas secciones)
- `src/app/api/settings-2/bot/agentes/route.ts` (herramientas + registro)
- `src/app/(dashboard)/dashboard/settings-2/integraciones/page.tsx` (nuevas tarjetas activas)
- `src/app/(dashboard)/dashboard/settings-2/negocio/components/GeneralForm.tsx` (logo + color, verificar)

**Reutilizado sin tocar lógica**
- `integraciones_conectadas` / `integracion_logs` (064), `@react-pdf/renderer`,
  patrón token-auth, `logo_url` + `color_comprobante`.

---

## 4. Principios que NO se rompen
1. **Opt-out:** ausente = activo. Ningún tenant pierde funcionalidad al desplegar.
2. **Gating por integración:** tool sin credenciales = invisible al LLM, nunca error en runtime.
3. **Una fuente de verdad:** el `AGENT_REGISTRY`. UI, orquestador, integraciones y prompt leen de él.
4. **Cada fase compila y deploya sola.** Nada queda a medias.
5. **Branding centralizado:** boleta/cotización/nota leen `logo_url` + `color_comprobante` de Negocio.
6. **Seguridad de salientes:** Gmail/Telegram solo a destinatarios dados por el usuario/cliente,
   con rate-limit; nunca a direcciones provenientes de contenido de tools.
