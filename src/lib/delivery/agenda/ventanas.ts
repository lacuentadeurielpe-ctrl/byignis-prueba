/**
 * Lógica pura de ventanas de entrega — sin DB, sin UI. Testeable por trazado.
 *
 * Modelo: cada vehículo tiene una agenda (línea de tiempo del día). Un pedido
 * nuevo se acomoda en el primer hueco libre a partir de un piso de tiempo. Las
 * ventanas se ENCADENAN (se apilan después del trabajo activo) y los pedidos
 * PROGRAMADOS reservan su franja (un pedido normal nunca se les encima).
 */

import type { BloqueAgenda, OrigenVentana, VentanaEntrega } from './types'

const MIN = 60_000

export interface ParamsProponerVentana {
  ahora: Date
  /** Bloques ya existentes en la agenda del vehículo (cualquier orden). */
  bloquesExistentes: BloqueAgenda[]
  /** Minutos desde ahora para el primer pedido con vehículo ocioso. */
  tiempoBaseMin: number
  /** Ancho de la ventana base (primer pedido). */
  ventanaTamanoMin: number
  /** Ancho de cada bloque al encadenar = promedio del repartidor. */
  duracionBloqueMin: number
}

interface Intervalo {
  inicio: number // epoch ms
  fin: number
}

/** Ordena intervalos por inicio. */
function ordenar(intervalos: Intervalo[]): Intervalo[] {
  return [...intervalos].sort((a, b) => a.inicio - b.inicio)
}

/**
 * Primer instante ≥ `piso` donde cabe un bloque de `anchoMs` sin solaparse con
 * ningún intervalo ocupado. Si no cabe en ningún hueco, lo coloca después del
 * último intervalo. Esto es lo que hace que un PROGRAMADO reserve su franja:
 * su intervalo está en `ocupados`, así que la cadena salta por encima.
 */
export function primerHuecoLibre(piso: number, anchoMs: number, ocupados: Intervalo[]): number {
  let inicio = piso
  for (const iv of ordenar(ocupados)) {
    // El bloque cabe completo antes de que empiece este intervalo ocupado
    if (inicio + anchoMs <= iv.inicio) return inicio
    // Se solapa o queda dentro → mover el cursor justo después
    if (iv.fin > inicio) inicio = iv.fin
  }
  return inicio
}

/**
 * Propone la ventana para un pedido nuevo según el estado de la agenda.
 *  - Vehículo ocioso (sin cola activa) → ventana base: ahora + tiempoBase.
 *  - Con cola → se encadena después del trabajo activo (ancho = promedio).
 * En ambos casos respeta los programados ya reservados.
 */
export function proponerVentana(p: ParamsProponerVentana): VentanaEntrega {
  const ahoraMs = p.ahora.getTime()

  // Solo los bloques que aún no terminaron afectan al cálculo.
  const futuros = p.bloquesExistentes.filter((b) => b.ventana.fin.getTime() > ahoraMs)

  // "Cola activa" = trabajo real pendiente (no cuenta una reserva programada lejana).
  const hayCola = futuros.some((b) => b.ventana.origen !== 'programada')

  const origen: OrigenVentana = hayCola ? 'encadenada' : 'base'
  const anchoMin = hayCola ? p.duracionBloqueMin : p.ventanaTamanoMin
  const anchoMs = Math.max(1, anchoMin) * MIN

  const ocupados: Intervalo[] = futuros.map((b) => ({
    inicio: b.ventana.inicio.getTime(),
    fin: b.ventana.fin.getTime(),
  }))

  const piso = ahoraMs + Math.max(0, p.tiempoBaseMin) * MIN
  const inicioMs = primerHuecoLibre(piso, anchoMs, ocupados)

  return {
    inicio: new Date(inicioMs),
    fin: new Date(inicioMs + anchoMs),
    origen,
    confirmada: false,
  }
}

/** Una ventana fija para un pedido programado: respeta la hora pedida tal cual. */
export function ventanaProgramada(fechaProgramada: Date, ventanaTamanoMin: number): VentanaEntrega {
  return {
    inicio: fechaProgramada,
    fin: new Date(fechaProgramada.getTime() + Math.max(1, ventanaTamanoMin) * MIN),
    origen: 'programada',
    confirmada: false,
  }
}

export interface ParamsRecomputar {
  ahora: Date
  tiempoBaseMin: number
}

export interface CambioVentana {
  entregaId: string
  inicio: Date
  fin: Date
}

/** Un bloque está anclado si no debe moverse al recomputar la cadena. */
function esAnclado(b: BloqueAgenda): boolean {
  return (
    b.ventana.confirmada ||
    b.ventana.origen === 'manual' ||
    b.ventana.origen === 'programada' ||
    b.ventana.origen === 'agrupada'
  )
}

/**
 * Re-encadena los bloques movibles (`encadenada` y no confirmados) tras un
 * cambio manual: los anclados quedan fijos y los movibles se reacomodan en
 * orden, preservando su propio ancho. Devuelve solo los que cambiaron.
 */
export function recomputarCadena(bloques: BloqueAgenda[], p: ParamsRecomputar): CambioVentana[] {
  const ahoraMs = p.ahora.getTime()
  const piso = ahoraMs + Math.max(0, p.tiempoBaseMin) * MIN

  const ordenados = [...bloques].sort(
    (a, b) => a.ventana.inicio.getTime() - b.ventana.inicio.getTime(),
  )

  // Los anclados ocupan su franja desde el inicio.
  const ocupados: Intervalo[] = ordenados
    .filter(esAnclado)
    .map((b) => ({ inicio: b.ventana.inicio.getTime(), fin: b.ventana.fin.getTime() }))

  const cambios: CambioVentana[] = []

  for (const b of ordenados) {
    if (esAnclado(b)) continue
    const anchoMs = Math.max(MIN, b.ventana.fin.getTime() - b.ventana.inicio.getTime())
    const inicioMs = primerHuecoLibre(piso, anchoMs, ocupados)
    const finMs = inicioMs + anchoMs
    ocupados.push({ inicio: inicioMs, fin: finMs })

    if (inicioMs !== b.ventana.inicio.getTime() || finMs !== b.ventana.fin.getTime()) {
      cambios.push({ entregaId: b.entregaId, inicio: new Date(inicioMs), fin: new Date(finMs) })
    }
  }

  return cambios
}

// ── Formateo (Lima) ───────────────────────────────────────────────────────────

function horaLima(d: Date): string {
  const s = d.toLocaleTimeString('es-PE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Lima',
  })
  return s
    .replace(/ /g, ' ')
    .replace(/\s*a\.?\s*m\.?/i, ' am')
    .replace(/\s*p\.?\s*m\.?/i, ' pm')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "1:00 am – 1:30 pm" en horario de Lima. */
export function formatearVentana(inicio: Date, fin: Date): string {
  return `${horaLima(inicio)} – ${horaLima(fin)}`
}

/** Igual que formatearVentana pero acepta strings ISO (para la UI); null si faltan. */
export function formatearVentanaISO(
  inicio?: string | null,
  fin?: string | null,
): string | null {
  if (!inicio || !fin) return null
  return formatearVentana(new Date(inicio), new Date(fin))
}
