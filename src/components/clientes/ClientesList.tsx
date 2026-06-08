'use client'

import { useEffect, useState } from 'react'
import { Loader, AlertCircle } from 'lucide-react'
import ClientesTable from './ClientesTable'

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

  return <ClientesTable clientes={clientes} esDueno={true} />
}
