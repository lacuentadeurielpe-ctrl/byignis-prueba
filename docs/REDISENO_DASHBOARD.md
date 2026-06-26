# Rediseño del Panel — Uintegrus

Plan de reestructuración visual y funcional de todo el panel, pantalla por pantalla.
Objetivo: que en 3 segundos se entienda cómo va el negocio y en 30 se sepa qué hacer.
Fácil para cualquiera, pero con el nivel visual de una startup grande (Stripe / Linear / Vercel).

## Decisiones del dueño (2026-06-14)
- **Titular del día:** mostrar dinero + operación juntos (dividido izquierda/derecha).
- **Alcance:** rediseñar TODO el panel, una pantalla a la vez.
- **Metas/objetivos:** NO por ahora — solo datos reales y tendencias.

## Principios de diseño
- Aire para respirar; nada amontonado.
- Color con significado (verde=bien, ámbar=ojo, rojo=urgente). Nada decorativo.
- Jerarquía: lo importante grande, el detalle chico.
- Lenguaje humano ("de cada 10 chats, 3 compran").
- Impecable en celular (el dueño revisa desde el teléfono).
- Se adapta al rol: dueño ve dinero/ganancia; vendedor ve tareas.
- Marca Uintegrus (colores alineados al logo).

## Estructura nueva del Dashboard principal (orden de arriba a abajo)
1. Titular del día — dinero (ventas hoy + vs ayer) y operación (pedidos + qué atender), lado a lado.
2. Necesita tu atención — 3-4 tarjetas accionables priorizadas (por cobrar, chats, stock, entregas atrasadas).
3. Números clave — tarjetas agrupadas (Ventas / Operación) con tendencias.
4. Gráficos protagonistas — ventas en el tiempo, origen (WhatsApp vs POS), top productos/clientes.
5. Flujo de pedidos — pipeline visual por etapa.
6. En vivo — feed de actividad en tiempo real.

## Lo que se conserva (ya funciona)
- Motor en tiempo real, alertas inteligentes (Inbox), menú lateral. Se mejoran, no se reinventan.

## Orden de pantallas (propuesto, por uso)
1. [ ] Dashboard principal (la cara del sistema)
2. [ ] Ventas (pedidos, pagos, deudas)
3. [ ] Finanzas
4. [ ] Clientes / CRM
5. [ ] Catálogo
6. [ ] Delivery
7. [ ] Chat / Conversaciones
8. [ ] Facturación · Salud · Ajustes

## Checklist por fases (Dashboard principal primero)
- [ ] Fase 0 — Paleta Uintegrus + decidir qué se queda/va
- [ ] Fase 1 — Esqueleto + sistema de tarjetas reutilizable
- [ ] Fase 2 — Titular del día (dinero + operación, lado a lado)
- [ ] Fase 3 — Centro de atención priorizado con acciones
- [ ] Fase 4 — Números agrupados por tema con tendencias
- [ ] Fase 5 — Gráficos protagonistas (tiempo, origen, top)
- [ ] Fase 6 — Pipeline visual + feed en vivo
- [ ] Fase 7 — Pulido (animación, modo oscuro, celular, velocidad, datos reales)
- [ ] Fase 8 — Revisar con el dueño → build → publicar

## Estado actual del código (referencia)
- Página: `src/app/(dashboard)/dashboard/page.tsx`
- Componentes: `src/components/dashboard/v2/` (Snapshot, KPIs, Pipeline, Feed, Charts, Inbox, Realtime)
- Datos: APIs en `src/app/api/dashboard/` (kpi, snapshot, charts, feed, pipeline, inbox)
- Menú: `src/components/layout/Sidebar.tsx`
