import { useState, useMemo, useEffect, useRef } from 'react'
import { matchesFuzzy } from '@/lib/utils'

export function useOrderFilters(pedidos: any[]) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroFecha, setFiltroFecha] = useState('')

  // Debounce la búsqueda 200ms para no correr Levenshtein en cada tecla (BUG-007)
  const [busquedaDelay, setBusquedaDelay] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setBusquedaDelay(busqueda), 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busqueda])

  function estaEnRango(fecha: string, rango: string): boolean {
    if (!rango) return true
    const d = new Date(fecha)
    const ahora = new Date()
    ahora.setHours(23, 59, 59, 999)
    const inicio = new Date()
    inicio.setHours(0, 0, 0, 0)
    if (rango === 'hoy') return d >= inicio && d <= ahora
    if (rango === 'semana') {
      inicio.setDate(inicio.getDate() - inicio.getDay())
      return d >= inicio && d <= ahora
    }
    if (rango === 'mes') {
      inicio.setDate(1)
      return d >= inicio && d <= ahora
    }
    return true
  }

  const filtrados = useMemo(() => {
    return pedidos.filter((p) => {
      const nombreCliente = p.clientes?.nombre ?? p.nombre_cliente ?? ''
      const telefono = p.clientes?.telefono ?? p.telefono_cliente ?? ''

      // Usa busquedaDelay (debounced) en vez de busqueda para evitar Levenshtein en cada tecla
      const matchBusqueda = matchesFuzzy(`${nombreCliente} ${telefono} ${p.numero_pedido}`, busquedaDelay)

      const matchEstado = !filtroEstado || p.estado === filtroEstado
      const matchFecha = estaEnRango(p.created_at, filtroFecha)

      return matchBusqueda && matchEstado && matchFecha
    })
  }, [pedidos, busquedaDelay, filtroEstado, filtroFecha])

  const hayFiltros = busqueda || filtroEstado || filtroFecha

  const conteosEstados = useMemo(() => {
    const conteos: Record<string, number> = {}
    for (const p of pedidos) {
      conteos[p.estado] = (conteos[p.estado] || 0) + 1
    }
    return conteos
  }, [pedidos])

  return {
    pedidos,
    busqueda,
    setBusqueda,
    filtroEstado,
    setFiltroEstado,
    filtroFecha,
    setFiltroFecha,
    filtrados,
    hayFiltros,
    conteosEstados
  }
}
