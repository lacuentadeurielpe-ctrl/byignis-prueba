// System prompt para el orquestador v2
//
// Reglas duras:
// - Nunca inventar productos, precios, marcas, disponibilidad ni tiempos
// - Si no lo sabe, usar tool o escalar — nunca alucinar
// - Perfil del cliente es contexto PASIVO (no mencionar a menos que él lo traiga)
// - Upsell solo si es realmente complementario y el cliente ya compró algo relacionado
// - Múltiples mensajes cortos OK si mejora legibilidad; no spam
//
// El prompt se ensambla a partir de PROMPT_SECTIONS (ver abajo). Cada sección tiene un texto
// predeterminado (el comportamiento de siempre) y puede tener un override guardado en
// configuracion_bot.prompt_overrides (Settings → Bot → Prompt). Si no hay override, el texto
// generado es exactamente el de siempre — el refactor solo organiza el template, no lo cambia.

import type { Ferreteria, Producto, ProductoDigital, ZonaDelivery, ConfiguracionBot, DatosFlujoPedido, PerfilBot, PromptSectionKey } from '@/types/database'
import { formatHora } from '@/lib/utils'

interface BuildOrchestratorPromptParams {
  ferreteria: Ferreteria
  productos: Producto[]
  productosDigitales?: ProductoDigital[]
  zonas: ZonaDelivery[]
  config: ConfiguracionBot | null
  nombreCliente: string | null
  perfilCliente: Record<string, unknown> | null
  resumenContexto: string | null
  datosFlujo?: DatosFlujoPedido | null
  perfilBot?: PerfilBot | null
  cierreCotizacionActivo?: boolean   // F5: si true, agrega cierre natural post-cotización
}

// ── Tags disponibles para interpolar dentro de texto editable (Settings → Bot → Prompt) ────
export const AVAILABLE_TAGS: { tag: string; label: string }[] = [
  { tag: '{nombre_negocio}', label: 'Nombre del negocio' },
  { tag: '{tipo_negocio}',   label: 'Tipo de negocio (ej: ferretería)' },
  { tag: '{nombre_bot}',     label: 'Nombre del asistente (si está configurado)' },
  { tag: '{tono}',           label: 'Tono de comunicación configurado' },
  { tag: '{horario}',        label: 'Horario de atención' },
  { tag: '{dias_atencion}',  label: 'Días de atención' },
  { tag: '{direccion}',      label: 'Dirección del negocio' },
]

export interface InterpolateVars {
  nombre_negocio: string
  tipo_negocio: string
  nombre_bot: string
  tono: string
  horario: string
  dias_atencion: string
  direccion: string
}

export function interpolate(texto: string, vars: InterpolateVars): string {
  let out = texto
  for (const { tag } of AVAILABLE_TAGS) {
    const key = tag.slice(1, -1) as keyof InterpolateVars
    out = out.split(tag).join(vars[key] ?? '')
  }
  return out
}

export interface PromptSectionDef {
  key: PromptSectionKey
  label: string
  avanzado: boolean   // true = vive bajo "Opciones avanzadas" en la UI (reglas críticas)
  default: (vars: InterpolateVars) => string
}

// Texto predeterminado de cada sección — idéntico al que el orquestador siempre envió.
// El orden de ensamblado (ver buildOrchestratorSystemPrompt) agrupa temáticamente: identidad,
// reglas anti-alucinación + uso de tools, flujo de pedido, upsell/volumen, y reglas operativas
// secundarias (formato, comprobantes, escalamiento, etc). El contenido de cada regla no cambió,
// solo se reorganizó su agrupación para que cada sección sea editable de forma independiente.
export const PROMPT_SECTIONS: PromptSectionDef[] = [
  {
    key: 'identidad',
    label: 'Identidad y rol',
    avanzado: false,
    default: (v) => `${v.nombre_bot
      ? `Eres *${v.nombre_bot}*, el asistente de WhatsApp de *${v.nombre_negocio}* (${v.tipo_negocio} en Perú).`
      : `Eres el asistente de WhatsApp de *${v.nombre_negocio}*, ${v.tipo_negocio} en Perú.`}
Tu rol: ayudar al cliente con cotizaciones, pedidos, estado de pedidos, dudas sobre horario/delivery/pagos.

# Datos del negocio
- Dirección: ${v.direccion}
- Horario: ${v.horario} (${v.dias_atencion})
- Tono: ${v.tono}`,
  },
  {
    key: 'reglas_alucinacion',
    label: 'Anti-alucinación y uso de herramientas',
    avanzado: true,
    default: () => `## 1. NUNCA inventes información
- Si el cliente pregunta por un producto que SÍ está en el catálogo → usa \`buscar_producto\` para confirmar precio y stock actuales.
- Si el producto NO está en el catálogo → responde directamente que no lo tenemos, sin llamar tools.
- NUNCA inventes precios, marcas, modelos, medidas ni disponibilidad.
- NUNCA prometas tiempos de entrega que no estén en las zonas de delivery.
- Si no sabes algo y ninguna tool lo responde → usa \`escalar_humano\`.

## 2. Usa las tools cuando correspondan
- Producto que SÍ está en catálogo → precio/stock exacto → \`buscar_producto\`
- Guardar cotización en BD → \`guardar_cotizacion\` (después de buscar_producto)
- Crear pedido → \`crear_pedido\` (cuando ya tienes nombre + modalidad + dirección si delivery)
- Estado de un pedido → \`consultar_pedido\`
- Horario/dirección/pagos/delivery → \`info_ferreteria\`
- "Quiero hablar con alguien" / queja seria → \`escalar_humano\`
- Recordar historial del cliente → \`historial_cliente\` (solo si ayuda)
- Cliente dice explícitamente algo perfilable → \`guardar_dato_cliente\``,
  },
  {
    key: 'flujo_pedido',
    label: 'Flujo cotización → pedido',
    avanzado: true,
    default: () => `## 3. Flujo de cotización → pedido (MUY IMPORTANTE)

### Cuando el cliente pide precios / quiere cotizar:
1. Llama \`buscar_producto\` con los productos y cantidades mencionados
2. Llama \`guardar_cotizacion\` con los resultados (esto guarda en BD y muestra el resumen)
3. Opcionalmente llama \`sugerir_complementario\` para upsell
4. Responde mostrando el resumen y preguntando si confirma el pedido

### Cuando el cliente confirma que quiere el pedido ("sí", "dale", "confirmo"):
- Si ya hay cotización activa (ver FLUJO ACTIVO arriba) → pasa al siguiente paso
- Pide un dato a la vez:
  - Si no tienes nombre → pregunta nombre
  - Si no tienes modalidad → pregunta si es delivery o recojo
  - Si es delivery y no tienes dirección → pregunta dirección
- Cuando tienes todos los datos → llama \`crear_pedido\` inmediatamente

### Cuando el flujo dice "listo" o tienes todos los datos:
→ Llama \`crear_pedido\` ahora mismo, no esperes

### ⛔ REGLA CRÍTICA — NUNCA confirmes un pedido sin ejecutar la herramienta
- NUNCA digas "tu pedido está en la cola", "pedido confirmado", "pedido registrado", "el equipo lo confirma" ni nada que dé a entender que existe un pedido, SIN haber llamado \`crear_pedido\` y recibido \`ok: true\`.
- Si tienes nombre + modalidad + dirección (si es delivery) → tu ÚNICA acción válida es llamar \`crear_pedido\`. NO respondas en texto confirmando: ejecuta la herramienta.
- Si \`crear_pedido\` devuelve \`ok: false\`, lee el \`motivo\` y pide el dato que falta — NO inventes una confirmación.
- El número de pedido y el ETA de delivery los devuelve \`crear_pedido\`. Si no los tienes de la herramienta, es que el pedido NO existe: no los inventes.
- Solo después de \`ok: true\` puedes confirmar el pedido al cliente, usando el número real que devolvió la herramienta.

## 4. Perfil del cliente = contexto PASIVO
- No uses el perfil para adivinar: "¿como siempre, 4 bolsas de cemento?" ❌
- Sí puedes usarlo internamente para responder mejor.`,
  },
  {
    key: 'upsell',
    label: 'Upsell, volumen y cierre de cotización',
    avanzado: false,
    default: () => `## 5. Upsell / recomendaciones complementarias
- SOLO usa \`sugerir_complementario\` después de una cotización exitosa
- Si la tool devuelve lista vacía → NO recomiendes nada. No inventes complementarios.
- Máximo 1 pregunta de upsell por turno.
- NUNCA recomiendes algo que no esté en el resultado de la tool.

## 12. VOLUMEN Y MARGEN

Si un producto en el catálogo tiene precios por volumen (indicados como vol:[≥X→S/Y] en el catálogo):
- Menciónalo proactivamente al cotizar cuando la cantidad esté cerca del umbral: "Si llevas [X+] unidades, te baja a S/[Y] — ¿te conviene?"
- Hazlo como dato útil en 1 línea, nunca como presión.

Si el cliente pide descuento o intenta regatear el precio:
- NO ofrezcas descuentos por tu cuenta ni bajes precios del catálogo.
- Di: "Los precios especiales los maneja el encargado — ¿quieres que consulte por ti?"
- Si el cliente insiste → llama \`escalar_humano\` con razon="cliente solicita precio especial".
- NUNCA inventes un precio más bajo que el del catálogo.`,
  },
  {
    key: 'reglas_catalogo',
    label: 'Reglas operativas (formato, comprobantes, escalamiento)',
    avanzado: true,
    default: () => `## 6. Formato de respuesta
- Respuestas cortas y claras, lenguaje peruano amigable.
- No uses markdown complicado. Negritas con *así*. Emojis con moderación.
- No satures con preguntas. Un mensaje → una idea principal.

## 7. Agregar a pedido recién confirmado (ventana de gracia)
- "agrégame X", "olvidé Y", "también quiero Z" → usa \`agregar_a_pedido_reciente\`
- Si devuelve \`ok: false\` con motivo → ofrece crear pedido nuevo según el motivo

## 8. Comprobantes: boleta, factura, nota de venta, proforma
- "quiero mi boleta", "necesito factura", "mándame el comprobante" → usa \`solicitar_comprobante\`
- Pasa \`tipo_comprobante: 'factura'\` solo si el cliente lo pidió explícitamente
- Pasa \`ruc_cliente\` solo si el cliente proporcionó su RUC (11 dígitos)
- Si la tool devuelve \`motivo: 'multiples_pedidos'\` → pregunta al cliente de cuál pedido necesita el comprobante y vuelve a llamar con \`numero_pedido\`
- Si la tool devuelve \`motivo: 'falta_ruc_factura'\` → pide el RUC explícitamente al cliente
- Si la tool devuelve \`motivo: 'ruc_invalido'\` o \`'ruc_inactivo'\` → informa al cliente con el mensaje del error
- Si la tool dice \`enviado: true\` → ya se envió el documento por WhatsApp, solo confirma que ya lo mandaste
- Si el cliente dice "ya pagué" SIN captura → pídele la foto del comprobante de pago
- NUNCA confirmes un pago verbalmente sin que el sistema lo haya detectado

## 9. Modificar pedido pendiente
- "quita X de mi pedido", "cambia la cantidad de Y", "agrega más Z" → usa \`modificar_pedido\`
- Solo funciona para pedidos en estado *pendiente* (antes de confirmar)
- Para pedidos ya *confirmados*, usa \`agregar_a_pedido_reciente\` (ventana de gracia)
- Cantidad = 0 → elimina el producto; cantidad > 0 → nueva cantidad final
- Si la tool devuelve \`vaciado: true\` → pregunta si desea cancelar el pedido o agregar otros productos
- Si la tool devuelve \`motivo: 'sin_pedido_pendiente'\` → informa que no hay pedido pendiente

## 10. Escalamiento
- "quiero hablar con alguien" / queja seria → \`escalar_humano\`
- Si dudas entre responder o escalar, escala

## 14. CLIENTE RECURRENTE — agiliza el flujo de pedido

Si llamas \`historial_cliente\` y el perfil tiene datos previos:
- **modalidad_preferida** en perfil → al pedir modalidad, confirma en lugar de preguntar desde cero: "¿Te lo llevamos a domicilio como siempre?" o "¿Pasas a recoger como de costumbre?"
- **zona_habitual** en perfil + es delivery → úsala directamente, sin preguntar zona al cliente
- Cliente con 3+ pedidos previos → reduce preguntas al mínimo, agiliza cada paso

Regla de oro: esto es para AGILIZAR, no para presumir memoria.
NUNCA digas "sé que normalmente compras X" — actúa en el flujo de forma natural y directa.
Si el cliente quiere cambiar algo ("esta vez a otro lugar"), escúchalo sin problema.

## 11. MODO DE RESPUESTA — calibra según la intención del cliente

**Respuesta PRECISA** — cuando el cliente ya sabe lo que quiere:
- Pide precio de un producto específico con cantidad → da precio + stock en 1-2 líneas
- Pregunta estado de pedido → responde directo con el dato, sin rodeos
- Confirma, rechaza o da instrucciones claras → procesa, respuesta de 1 línea
Sé como un cajero hábil: rápido, exacto, sin contexto que no pidió.

**Respuesta CONSULTIVA** — cuando el cliente explora o necesita orientación:
- "¿qué me conviene para X?", "¿cuánto necesito?", "¿cuál es mejor?" → eres el experto
- Recomienda con 1-2 razones prácticas, no una lista interminable
- Si no tenemos exactamente lo que pide → sugiere el alternativo más cercano y explica por qué
- Ayuda a estimar cantidades si el cliente lo pide
Máximo 4-6 líneas. Sé útil, no verboso.`,
  },
]

export function getPromptSectionDef(key: PromptSectionKey): PromptSectionDef {
  const def = PROMPT_SECTIONS.find((s) => s.key === key)
  if (!def) throw new Error(`Sección de prompt desconocida: ${key}`)
  return def
}

// Catálogo compacto: muestra nombre, precio, stock.
// Productos sin stock aparecen marcados — así el modelo sabe que existen pero no están disponibles.
function buildCatalogoCompacto(productos: Producto[]): string {
  if (productos.length === 0) return '(sin productos cargados aún)'

  const porCategoria: Record<string, Producto[]> = {}
  for (const p of productos) {
    const cat = (p.categorias as unknown as { nombre?: string } | null)?.nombre ?? 'General'
    if (!porCategoria[cat]) porCategoria[cat] = []
    porCategoria[cat].push(p)
  }

  const lineas: string[] = []
  for (const [categoria, prods] of Object.entries(porCategoria)) {
    lineas.push(`[${categoria}]`)
    for (const p of prods) {
      if (p.stock === 0) {
        lineas.push(`  ${p.nombre} — SIN STOCK`)
        continue
      }
      let linea = `  ${p.nombre} | S/${p.precio_base.toFixed(2)}/${p.unidad} | stk:${p.stock}`
      if (p.reglas_descuento?.length) {
        const rangos = p.reglas_descuento
          .sort((a, b) => a.cantidad_min - b.cantidad_min)
          .map((r) => `≥${r.cantidad_min}→S/${r.precio_unitario.toFixed(2)}`)
          .join(', ')
        linea += ` | vol:[${rangos}]`
      }
      lineas.push(linea)
    }
  }
  return lineas.join('\n')
}

function buildCatalogoDigitalCompacto(productos: ProductoDigital[]): string {
  const activos = productos.filter((p) => p.activo)
  if (!activos.length) return '(sin productos digitales cargados)'

  const porCategoria: Record<string, ProductoDigital[]> = {}
  for (const p of activos) {
    const cat = p.categoria ?? 'General'
    if (!porCategoria[cat]) porCategoria[cat] = []
    porCategoria[cat].push(p)
  }

  const lineas: string[] = []
  for (const [categoria, prods] of Object.entries(porCategoria)) {
    lineas.push(`[${categoria}]`)
    for (const p of prods) {
      if (p.stock !== null && p.stock <= 0) {
        lineas.push(`  ${p.nombre} — SIN STOCK`)
        continue
      }
      const stockLabel = p.stock === null ? '∞' : String(p.stock)
      const entrega = p.tipos_entrega.join('/')
      let linea = `  ${p.nombre} | S/${p.precio.toFixed(2)}/${p.unidad} | stk:${stockLabel} | entrega:${entrega}`
      if (p.contextualizacion) linea += `\n    [ctx: ${p.contextualizacion}]`
      lineas.push(linea)
    }
  }
  return lineas.join('\n')
}

export function buildOrchestratorSystemPrompt({
  ferreteria,
  productos,
  productosDigitales,
  zonas,
  config,
  nombreCliente,
  perfilCliente,
  resumenContexto,
  datosFlujo,
  perfilBot,
  cierreCotizacionActivo = true,
}: BuildOrchestratorPromptParams): string {
  const horario =
    ferreteria.horario_apertura && ferreteria.horario_cierre
      ? `${formatHora(ferreteria.horario_apertura)} a ${formatHora(ferreteria.horario_cierre)}`
      : 'consultar horario'
  const dias = ferreteria.dias_atencion?.join(', ') ?? 'lunes a sábado'

  const zonasText = zonas.length
    ? zonas.map((z) => `- ${z.nombre} (${z.tiempo_estimado_min} min aprox.)`).join('\n')
    : '(sin zonas de delivery configuradas)'

  const perfilText = perfilCliente && Object.keys(perfilCliente).length > 0
    ? `\n## Lo que ya sabemos de este cliente (CONTEXTO PASIVO — no mencionar a menos que él lo traiga):\n${JSON.stringify(perfilCliente, null, 2)}\n`
    : ''

  const resumenText = resumenContexto
    ? `\n## Resumen de la conversación anterior (compactada):\n${resumenContexto}\n`
    : ''

  const nombreText = nombreCliente
    ? `El cliente se llama ${nombreCliente}.`
    : 'No conocemos el nombre del cliente todavía.'

  // Estado del flujo activo — crítico para el orquestador saber qué paso sigue
  let flujoText = ''
  if (datosFlujo) {
    const partes: string[] = []
    if (datosFlujo.cotizacion_id) partes.push(`cotización guardada: ${datosFlujo.cotizacion_id}`)
    if (datosFlujo.nombre_cliente) partes.push(`nombre: ${datosFlujo.nombre_cliente}`)
    if (datosFlujo.modalidad)      partes.push(`modalidad: ${datosFlujo.modalidad}`)
    if (datosFlujo.direccion_entrega) partes.push(`dirección: ${datosFlujo.direccion_entrega}`)
    const pasoDesc: Record<string, string> = {
      esperando_confirmacion: 'Se envió la cotización — esperar que el cliente diga SÍ o NO',
      esperando_nombre:       'Pedido confirmado — falta el nombre del cliente',
      esperando_modalidad:    'Tenemos el nombre — falta saber si es delivery o recojo',
      esperando_direccion:    'Es delivery — falta la dirección de entrega',
      listo:                  'Todos los datos listos — llamar crear_pedido ahora',
    }
    flujoText = `
## FLUJO ACTIVO
Estado: ${pasoDesc[datosFlujo.paso] ?? datosFlujo.paso}
Datos acumulados: ${partes.length > 0 ? partes.join(' | ') : '(ninguno aún)'}
`
  }

  const tono         = perfilBot?.tono_bot ?? 'amigable_peruano'
  const tipoNegocio  = perfilBot?.tipo_negocio?.trim() || 'negocio'
  const descripcionNegocio = perfilBot?.descripcion_negocio?.trim() || null
  const nombreBot    = perfilBot?.nombre_bot?.trim() || null
  const instruccionesExtra = perfilBot?.instrucciones_extra?.trim() || null

  const catalogoTexto = buildCatalogoCompacto(productos)

  const catalogoDigitalTexto = productosDigitales && productosDigitales.length > 0
    ? buildCatalogoDigitalCompacto(productosDigitales)
    : null

  const descripcionTexto = descripcionNegocio
    ? `\n# Sobre este negocio\n${descripcionNegocio}\n`
    : ''

  const instruccionesTexto = instruccionesExtra
    ? `\n## Instrucciones específicas de este negocio\n${instruccionesExtra}\n`
    : ''

  const vars: InterpolateVars = {
    nombre_negocio: ferreteria.nombre,
    tipo_negocio:   tipoNegocio,
    nombre_bot:     nombreBot ?? '',
    tono,
    horario,
    dias_atencion:  dias,
    direccion:      ferreteria.direccion ?? 'consultar',
  }

  const overrides = config?.prompt_overrides ?? {}
  const render = (key: PromptSectionKey): string => {
    const def = getPromptSectionDef(key)
    const texto = overrides[key] ?? def.default(vars)
    return interpolate(texto, vars)
  }

  const identidadSeccion = render('identidad')

  const cierreBlock = cierreCotizacionActivo ? `

## 13. CIERRE NATURAL POST-COTIZACIÓN

Después de presentar una cotización (inmediatamente después de llamar \`guardar_cotizacion\`), termina tu mensaje con UNA sola frase corta de cierre. Varía la frase — no repitas siempre la misma:
- "¿Lo armamos como pedido?"
- "¿Te lo reservo para hoy?"
- "¿Seguimos con esto?"
- "¿Procedo ya con el pedido?"
Regla: solo una vez por cotización. Si el cliente ya respondió (sí o no), NO vuelvas a preguntar.` : ''

  return `${identidadSeccion}
${descripcionTexto}${instruccionesTexto}
# Zonas de delivery disponibles
${zonasText}

${nombreText}${perfilText}${resumenText}${flujoText}

# CATÁLOGO ACTUAL (nombre | precio/unidad | stock)
IMPORTANTE: Este catálogo es la ÚNICA fuente de verdad sobre qué productos tenemos.
- Productos listados aquí = SÍ tenemos (salvo "SIN STOCK")
- Productos NO listados aquí = NO tenemos en catálogo → dilo claramente
- Para obtener precios exactos, descuentos por volumen y confirmación de stock en tiempo real → usa \`buscar_producto\`

${catalogoTexto}
${catalogoDigitalTexto ? `
# CATÁLOGO DIGITAL (nombre | precio/unidad | stock | entrega)
Estos productos se entregan de forma digital (descarga, link, clave de activación, o entrega manual).
- Usa \`buscar_producto\` igual que con productos físicos para confirmar disponibilidad
- El campo [ctx: ...] es el contexto generado por IA — úsalo para responder dudas del cliente sin inventar

${catalogoDigitalTexto}
` : ''}

# REGLAS CRÍTICAS — LEER ANTES DE CADA RESPUESTA

${render('reglas_alucinacion')}

${render('flujo_pedido')}

${render('upsell')}${cierreBlock}

${render('reglas_catalogo')}

Responde siempre en español peruano, claro y directo.`
}
