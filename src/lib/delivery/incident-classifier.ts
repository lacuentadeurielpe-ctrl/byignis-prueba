/**
 * Incident Classifier — Clasificación IA de incidencias de reparto
 *
 * Usa DeepSeek (ya instalado en el proyecto) para interpretar
 * texto libre del repartidor y clasificarlo en:
 *   - tipo de incidencia
 *   - severidad
 *   - tiempo estimado de resolución
 *   - acción recomendada
 *
 * Fallback basado en palabras clave si la IA no responde.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type TipoIncidencia =
  | 'averia_leve'         // pinchadura, batería, problema menor
  | 'averia_grave'        // motor, accidente leve, falla mecánica mayor
  | 'accidente'           // colisión, emergencia de tránsito
  | 'ruta_incorrecta'     // se equivocó de camino
  | 'cliente_ausente'     // no estaba en casa
  | 'direccion_incorrecta' // dirección no existe o no se encuentra
  | 'zona_peligrosa'      // zona de riesgo, no puede acceder
  | 'trafico_severo'      // atasco, marcha, cierre de vía
  | 'clima'               // lluvia intensa, inundación
  | 'emergencia_personal' // problema personal del repartidor
  | 'otro'

export type SeveridadIncidencia = 'baja' | 'media' | 'alta' | 'critica'

export interface ClasificacionIncidencia {
  tipo:                  TipoIncidencia
  severidad:             SeveridadIncidencia
  descripcionNormalizada: string          // versión limpia/normalizada del texto
  tiempoEstimadoMin:     number | null    // null = indeterminado
  accionRecomendada:     string           // qué debe hacer el sistema
  requiereIntervencion:  boolean          // true = escalar al dueño inmediatamente
  puedeAutorreparar:     boolean          // puede el repartidor resolverlo solo
  fuente:                'ia' | 'reglas'  // cómo se clasificó
}

// ── Reglas de fallback (sin IA) ───────────────────────────────────────────────

const REGLAS: Array<{
  palabras:    RegExp
  tipo:        TipoIncidencia
  severidad:   SeveridadIncidencia
  minutos:     number | null
  accion:      string
  intervenir:  boolean
  autorrep:    boolean
}> = [
  {
    palabras:   /pinch[ao]|llanta|neumático|caucho|puncture/i,
    tipo:       'averia_leve', severidad: 'media', minutos: 40,
    accion:     'Reparar llanta en campo. Si no tiene repuesto, solicitar asistencia técnica',
    intervenir: false, autorrep: true,
  },
  {
    palabras:   /batería|no arranca|no prende|motor|fren[oa]|frenos|cadena|transmisión/i,
    tipo:       'averia_grave', severidad: 'alta', minutos: 120,
    accion:     'Solicitar asistencia técnica o grúa. Reasignar entregas pendientes',
    intervenir: true, autorrep: false,
  },
  {
    palabras:   /accidente|choc[oa]|colisión|impact[oa]|caíd[ao]|volcó/i,
    tipo:       'accidente', severidad: 'critica', minutos: null,
    accion:     'Verificar estado del repartidor INMEDIATAMENTE. Llamar si es necesario',
    intervenir: true, autorrep: false,
  },
  {
    palabras:   /perdid[ao]|equivoc[aoé]|ruta|camin[ao] mal|no sé dónde|me perdí/i,
    tipo:       'ruta_incorrecta', severidad: 'baja', minutos: 15,
    accion:     'Enviar dirección correcta por WhatsApp con link de Google Maps',
    intervenir: false, autorrep: true,
  },
  {
    palabras:   /no est[aá]|nadie|puerta cerrada|no abre|ausente|no contesta|no hay nadie/i,
    tipo:       'cliente_ausente', severidad: 'baja', minutos: 10,
    accion:     'Llamar al cliente. Si no responde en 10min, decidir entre esperar o retornar',
    intervenir: false, autorrep: true,
  },
  {
    palabras:   /dirección.*no existe|no encuentro|no aparece|dirección.*mal|no hay.*calle/i,
    tipo:       'direccion_incorrecta', severidad: 'media', minutos: 20,
    accion:     'Contactar al cliente para confirmar dirección exacta',
    intervenir: false, autorrep: true,
  },
  {
    palabras:   /peligroso|asalto|robo|amenaza|zona.*riesgo|no puedo entrar/i,
    tipo:       'zona_peligrosa', severidad: 'alta', minutos: null,
    accion:     'No forzar la entrega. Coordinar con el dueño una alternativa segura',
    intervenir: true, autorrep: false,
  },
  {
    palabras:   /tráfico|tránsito|atasco|marcha|manifestación|cerrad[ao]|bloquead[ao]/i,
    tipo:       'trafico_severo', severidad: 'media', minutos: 30,
    accion:     'Actualizar ETA del cliente automáticamente. Buscar ruta alternativa',
    intervenir: false, autorrep: true,
  },
  {
    palabras:   /lluvia|inundación|garúa|diluvio|no puedo.*clima|mojado/i,
    tipo:       'clima', severidad: 'media', minutos: 20,
    accion:     'Notificar al cliente del retraso por clima. Evaluar si es seguro continuar',
    intervenir: false, autorrep: true,
  },
  {
    palabras:   /emergencia.*personal|familiar|enferm[oa]|accidente.*personal|tengo que ir/i,
    tipo:       'emergencia_personal', severidad: 'alta', minutos: null,
    accion:     'Reasignar todas las entregas del repartidor. Verificar su bienestar',
    intervenir: true, autorrep: false,
  },
]

// ── Clasificación por reglas (fallback) ───────────────────────────────────────

function clasificarPorReglas(texto: string): ClasificacionIncidencia {
  const textoLower = texto.toLowerCase()

  for (const regla of REGLAS) {
    if (regla.palabras.test(textoLower)) {
      return {
        tipo:                  regla.tipo,
        severidad:             regla.severidad,
        descripcionNormalizada: texto.trim(),
        tiempoEstimadoMin:     regla.minutos,
        accionRecomendada:     regla.accion,
        requiereIntervencion:  regla.intervenir,
        puedeAutorreparar:     regla.autorrep,
        fuente:                'reglas',
      }
    }
  }

  // Default: otro
  return {
    tipo:                  'otro',
    severidad:             'media',
    descripcionNormalizada: texto.trim(),
    tiempoEstimadoMin:     30,
    accionRecomendada:     'Revisar con el repartidor y tomar acción manual',
    requiereIntervencion:  true,
    puedeAutorreparar:     false,
    fuente:                'reglas',
  }
}

// ── Clasificación con IA (DeepSeek) ───────────────────────────────────────────

export async function clasificarIncidencia(
  textoRepartidor: string,
  contexto?: {
    nombreRepartidor?: string
    numeroPedido?:     string
    zona?:             string
  },
): Promise<ClasificacionIncidencia> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return clasificarPorReglas(textoRepartidor)
  }

  const prompt = `Eres un clasificador de incidencias de reparto para una ferretería en Lima, Perú.
El repartidor ${contexto?.nombreRepartidor ?? ''} reportó lo siguiente sobre el pedido ${contexto?.numeroPedido ?? ''}${contexto?.zona ? ` en la zona ${contexto.zona}` : ''}:

"${textoRepartidor}"

Clasifica esta incidencia en el siguiente JSON. Responde SOLO con JSON válido, sin texto adicional:
{
  "tipo": uno de: averia_leve|averia_grave|accidente|ruta_incorrecta|cliente_ausente|direccion_incorrecta|zona_peligrosa|trafico_severo|clima|emergencia_personal|otro,
  "severidad": uno de: baja|media|alta|critica,
  "descripcion_normalizada": descripción clara y concisa en español,
  "tiempo_estimado_min": número de minutos estimados para resolver (null si indeterminado),
  "accion_recomendada": qué debe hacer el sistema o el encargado,
  "requiere_intervencion": true si debe notificarse al dueño inmediatamente,
  "puede_autorreparar": true si el repartidor puede resolverlo sin ayuda externa
}`

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'deepseek-chat',
        messages:    [{ role: 'user', content: prompt }],
        max_tokens:  400,
        temperature: 0.1,  // baja temperatura para respuestas consistentes
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return clasificarPorReglas(textoRepartidor)

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const content = data.choices?.[0]?.message?.content
    if (!content) return clasificarPorReglas(textoRepartidor)

    // Limpiar posible markdown del LLM
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed  = JSON.parse(jsonStr)

    return {
      tipo:                  parsed.tipo ?? 'otro',
      severidad:             parsed.severidad ?? 'media',
      descripcionNormalizada: parsed.descripcion_normalizada ?? textoRepartidor,
      tiempoEstimadoMin:     parsed.tiempo_estimado_min ?? null,
      accionRecomendada:     parsed.accion_recomendada ?? 'Revisar con el encargado',
      requiereIntervencion:  parsed.requiere_intervencion ?? true,
      puedeAutorreparar:     parsed.puede_autorreparar ?? false,
      fuente:                'ia',
    }
  } catch {
    return clasificarPorReglas(textoRepartidor)
  }
}

// ── Actualizar factores de zona tras incidencia ───────────────────────────────

/**
 * Después de registrar una incidencia, actualiza los factores históricos
 * de la zona para que el ETA futuro los considere.
 */
export async function actualizarFactorZona(
  params: {
    ferreteriaId:   string
    zonaDeliveryId: string
    tipo:           TipoIncidencia
    demora_real_min?: number
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (t: string) => unknown },
): Promise<void> {
  const ahora    = new Date()
  const diaSemana = ahora.getDay()
  const horaBloque = parseInt(
    ahora.toLocaleString('en-US', { timeZone: 'America/Lima', hour: 'numeric', hour12: false }),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Obtener o crear fila de factores para esta zona+hora+día
  const { data: existente } = await sb
    .from('delivery_zona_factores')
    .select('id, total_entregas, total_incidencias, cliente_ausente, demoras_severas')
    .eq('ferreteria_id', params.ferreteriaId)
    .eq('zona_delivery_id', params.zonaDeliveryId)
    .eq('dia_semana', diaSemana)
    .eq('hora_bloque', horaBloque)
    .maybeSingle()

  const totalInc  = (existente?.total_incidencias ?? 0) + 1
  const totalEnt  = Math.max(existente?.total_entregas ?? 1, 1)
  const clienteAus = (existente?.cliente_ausente ?? 0) + (params.tipo === 'cliente_ausente' ? 1 : 0)
  const demorasSev = (existente?.demoras_severas ?? 0) + (params.demora_real_min && params.demora_real_min > 30 ? 1 : 0)

  // Factor de incidencia: 1.0 + (% incidencias × 0.5)
  const factorInc   = 1.0 + (totalInc / totalEnt) * 0.5
  const factorDemora = 1.0 + (demorasSev / totalEnt) * 0.3
  const penMin       = Math.min(Math.round((totalInc / totalEnt) * 10), 20)

  if (existente) {
    await sb.from('delivery_zona_factores').update({
      total_incidencias: totalInc,
      cliente_ausente:   clienteAus,
      demoras_severas:   demorasSev,
      factor_incidencia: Math.min(factorInc, 2.0),
      factor_demora:     Math.min(factorDemora, 2.0),
      penalizacion_min:  penMin,
      updated_at:        new Date().toISOString(),
    }).eq('id', existente.id)
  } else {
    await sb.from('delivery_zona_factores').insert({
      ferreteria_id:     params.ferreteriaId,
      zona_delivery_id:  params.zonaDeliveryId,
      dia_semana:        diaSemana,
      hora_bloque:       horaBloque,
      total_entregas:    1,
      total_incidencias: 1,
      cliente_ausente:   params.tipo === 'cliente_ausente' ? 1 : 0,
      demoras_severas:   params.demora_real_min && params.demora_real_min > 30 ? 1 : 0,
      factor_incidencia: 1.1,
      factor_demora:     1.0,
      penalizacion_min:  2,
    })
  }
}
