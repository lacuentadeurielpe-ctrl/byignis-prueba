'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import CreateClienteModal from './CreateClienteModal'

interface Cliente {
  id: string
  nombre: string
  telefono: string
  dni_ruc?: string
  tipo: string
  alias?: string
}

interface ClienteSelectorProps {
  value?: string
  onChange: (clienteId: string, cliente?: Cliente) => void
  placeholder?: string
  className?: string
}

export default function ClienteSelector({
  value,
  onChange,
  placeholder = 'Seleccionar cliente...',
  className = '',
}: ClienteSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)

  const fetchClientes = useCallback(async (query?: string) => {
    setLoading(true)
    try {
      const url = new URL('/api/clientes', window.location.origin)
      if (query) {
        url.searchParams.set('search', query)
      }
      url.searchParams.set('limit', '20')

      const response = await fetch(url)
      const data = await response.json()
      setClientes(data.data || [])
    } catch (err) {
      console.error('Error fetching clientes:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchClientes(search)
    }
  }, [isOpen, search, fetchClientes])

  useEffect(() => {
    if (value && clientes.length > 0) {
      const cliente = clientes.find(c => c.id === value)
      if (cliente) {
        setSelectedCliente(cliente)
      }
    }
  }, [value, clientes])

  const handleSelect = (cliente: Cliente) => {
    setSelectedCliente(cliente)
    onChange(cliente.id, cliente)
    setIsOpen(false)
    setSearch('')
  }

  const handleCreateSuccess = () => {
    fetchClientes('')
  }

  return (
    <div className={className}>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 text-left"
        >
          <span className={selectedCliente ? 'text-zinc-900' : 'text-zinc-500'}>
            {selectedCliente ? selectedCliente.nombre || selectedCliente.telefono : placeholder}
          </span>
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        </button>

        {isOpen && (
          <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-zinc-200 rounded-lg shadow-lg z-50">
            <div className="p-3 border-b border-zinc-200">
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-sm text-zinc-500">Cargando...</div>
              ) : clientes.length === 0 ? (
                <div className="p-4 text-center text-sm text-zinc-500">No hay clientes</div>
              ) : (
                clientes.map((cliente) => (
                  <button
                    key={cliente.id}
                    onClick={() => handleSelect(cliente)}
                    className="w-full px-4 py-2 text-left hover:bg-indigo-50 border-b border-zinc-100 last:border-b-0"
                  >
                    <div className="font-medium text-sm text-zinc-900">
                      {cliente.nombre || cliente.telefono}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {cliente.telefono} • {cliente.tipo}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-zinc-200 p-2">
              <button
                onClick={() => {
                  setShowCreateModal(true)
                  setIsOpen(false)
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded"
              >
                <Plus className="w-4 h-4" />
                Crear cliente
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateClienteModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  )
}
