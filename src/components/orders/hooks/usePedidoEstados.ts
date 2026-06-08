'use client'

import { useEffect, useState } from 'react'

export interface PedidoEstadoMeta {
  slug: string
  nombre: string
  orden: number
  color: string
  icono: string | null
  es_final: boolean
}

// Cache a nivel módulo para no re-fetchear el catálogo en cada montaje
let cache: PedidoEstadoMeta[] | null = null
let inflight: Promise<PedidoEstadoMeta[]> | null = null

async function fetchEstados(): Promise<PedidoEstadoMeta[]> {
  if (cache) return cache
  if (!inflight) {
    inflight = fetch('/api/pedido-estados')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PedidoEstadoMeta[]) => {
        cache = data
        return data
      })
      .catch(() => [])
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/**
 * Catálogo de estados de pedido (fuente de verdad para label/color).
 * Devuelve helpers que prefieren el catálogo y caen a un fallback si aún no cargó.
 */
export function usePedidoEstados() {
  const [estados, setEstados] = useState<PedidoEstadoMeta[]>(cache ?? [])

  useEffect(() => {
    let activo = true
    fetchEstados().then((data) => {
      if (activo) setEstados(data)
    })
    return () => {
      activo = false
    }
  }, [])

  const mapa = new Map(estados.map((e) => [e.slug, e]))

  function label(slug: string, fallback: string): string {
    return mapa.get(slug)?.nombre ?? fallback
  }

  function color(slug: string, fallback: string): string {
    return mapa.get(slug)?.color ?? fallback
  }

  return { estados, label, color }
}
