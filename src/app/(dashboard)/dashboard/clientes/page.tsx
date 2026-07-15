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
      {/* Header Premium */}
      <div className="relative mb-8 p-6 rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-900 shadow-xl overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 right-40 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl flex items-center justify-center shadow-inner">
              <Users className="w-6 h-6 text-indigo-50" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">CRM Clientes</h1>
              <p className="text-indigo-200 text-sm mt-0.5">Gestión integral de cartera y cuentas corrientes</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="group flex items-center gap-2 px-5 py-2.5 bg-white text-indigo-900 rounded-xl hover:bg-indigo-50 font-semibold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
            Nuevo Cliente
          </button>
        </div>
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
