'use client'

import { useState } from 'react'
import { Users, Plus } from 'lucide-react'
import ClientesSearch from '@/components/clientes/ClientesSearch'
import ClientesFilters from '@/components/clientes/ClientesFilters'
import ClientesList from '@/components/clientes/ClientesList'
import CreateClienteModal from '@/components/clientes/CreateClienteModal'

export default function ClientesPage() {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">CRM Clientes</h1>
            <p className="text-sm text-zinc-500">Gestión de cartera y cuentas corrientes</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
        >
          <Plus className="w-4 h-4" />
          Crear Cliente
        </button>
      </div>

      {/* Búsqueda y Filtros */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <ClientesSearch onSearch={setSearch} />
        </div>
        <ClientesFilters onFilterChange={setFilters} />
      </div>

      {/* Tabla de Clientes */}
      <ClientesList key={refreshKey} search={search} filters={filters} />

      {/* Modal Crear Cliente */}
      <CreateClienteModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false)
          setRefreshKey(k => k + 1)
        }}
      />
    </div>
  )
}
