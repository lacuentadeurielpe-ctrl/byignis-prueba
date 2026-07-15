'use client'

import { useEffect, useState, useMemo } from 'react'
import { Loader, AlertCircle, Users, Wallet, ReceiptText, TrendingUp, X } from 'lucide-react'
import { formatPEN } from '@/lib/utils'
import ClientesTable from './ClientesTable'
import IngresosDashboardModal from './IngresosDashboardModal'

interface ClienteResumen {
  id: string
  nombre: string | null
  telefono: string | null
  dni_ruc: string | null
  tipo: 'persona' | 'empresa' | 'anonimo'
  alias: string | null
  email: string | null
  telefono_secundario: string | null
  direccion_habitual: string | null
  notas_internas: string | null
  tags: string[]
  created_at: string
  totalPedidos: number
  pedidosCompletados: number
  totalGastado: number
  deuda: number
  ultimoPedido: string | null
}

interface ClientesListProps {
  search?: string
  filters?: any
}

export default function ClientesList({ search = '', filters }: ClientesListProps) {
  const [clientes, setClientes] = useState<ClienteResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState<'ninguno' | 'activos' | 'deuda'>('ninguno')
  const [showIngresosModal, setShowIngresosModal] = useState(false)

  useEffect(() => {
    const fetchClientes = async () => {
      setLoading(true)
      setError('')
      try {
        const url = new URL('/api/clientes', window.location.origin)
        if (search) url.searchParams.set('search', search)
        if (filters?.tipo) url.searchParams.set('tipo', filters.tipo)
        if (filters?.conDeuda !== undefined) url.searchParams.set('conDeuda', filters.conDeuda)
        if (filters?.desdeGasto) url.searchParams.set('desdeGasto', filters.desdeGasto)
        if (filters?.hastaGasto) url.searchParams.set('hastaGasto', filters.hastaGasto)

        const response = await fetch(url)
        if (!response.ok) throw new Error('Error al cargar clientes')

        const data = await response.json()
        setClientes(data.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    fetchClientes()
  }, [search, filters])

  const kpis = useMemo(() => {
    const totalClientes = clientes.length
    const clientesActivos = clientes.filter(c => c.totalPedidos > 0).length
    const ingresosTotales = clientes.reduce((acc, c) => acc + (c.totalGastado || 0), 0)
    const deudaTotal = clientes.reduce((acc, c) => acc + (c.deuda || 0), 0)

    return [
      { id: 'ninguno', label: 'Total Clientes', value: totalClientes.toString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', hoverBorder: 'hover:border-blue-300' },
      { id: 'activos', label: 'Clientes Activos', value: clientesActivos.toString(), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', hoverBorder: 'hover:border-emerald-300' },
      { id: 'ingresos', label: 'Ingresos Totales', value: formatPEN(ingresosTotales), icon: Wallet, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', hoverBorder: 'hover:border-indigo-300' },
      { id: 'deuda', label: 'Deuda Pendiente', value: formatPEN(deudaTotal), icon: ReceiptText, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', hoverBorder: 'hover:border-rose-300' },
    ]
  }, [clientes])

  const clientesMostrados = useMemo(() => {
    let list = [...clientes]
    if (activeFilter === 'deuda') {
      list = list.filter(c => (c.deuda || 0) > 0)
    } else if (activeFilter === 'activos') {
      list = list.filter(c => c.totalPedidos > 0)
      list.sort((a, b) => {
        if (!a.ultimoPedido) return 1
        if (!b.ultimoPedido) return -1
        return new Date(b.ultimoPedido).getTime() - new Date(a.ultimoPedido).getTime()
      })
    }
    return list
  }, [clientes, activeFilter])

  const handleKpiClick = (kpiId: string) => {
    if (kpiId === 'ingresos') {
      setShowIngresosModal(true)
    } else {
      setActiveFilter(kpiId as 'ninguno' | 'activos' | 'deuda')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm">{error}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* KPI Dashboard */}
      {clientes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => {
            const isActive = activeFilter === kpi.id
            const baseClass = "relative text-left rounded-2xl border p-5 shadow-sm transition-all duration-200 overflow-hidden outline-none"
            const stateClass = isActive
              ? `bg-zinc-50 border-zinc-400 ring-2 ring-zinc-200`
              : `bg-white border-zinc-100 hover:shadow-md ${kpi.hoverBorder}`
              
            return (
              <button
                key={kpi.id}
                onClick={() => handleKpiClick(kpi.id)}
                className={`${baseClass} ${stateClass}`}
              >
                {isActive && (
                  <div className="absolute top-3 right-3 p-1 rounded-full bg-zinc-200/50 text-zinc-500">
                    <X className="w-3 h-3" />
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${kpi.bg} ${kpi.border}`}>
                    <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${isActive ? 'text-zinc-600' : 'text-zinc-500'}`}>{kpi.label}</p>
                    <p className={`text-2xl font-bold tracking-tight ${isActive ? 'text-zinc-900' : 'text-zinc-800'}`}>{kpi.value}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Tabla */}
      <ClientesTable clientes={clientesMostrados} esDueno={true} />

      {/* Modal de Dashboard Completo de Ingresos */}
      <IngresosDashboardModal 
        isOpen={showIngresosModal} 
        onClose={() => setShowIngresosModal(false)} 
        clientes={clientes} 
      />
    </div>
  )
}
