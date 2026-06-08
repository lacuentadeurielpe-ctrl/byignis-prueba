'use client'

import { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'

interface FilterState {
  tipo?: string
  tags?: string[]
  conDeuda?: boolean
  desdeGasto?: number
  hastaGasto?: number
  desdeRecha?: string
  hastaFecha?: string
}

interface ClientesFiltersProps {
  onFilterChange: (filters: FilterState) => void
  className?: string
}

export default function ClientesFilters({
  onFilterChange,
  className = '',
}: ClientesFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>({})
  const [activeCount, setActiveCount] = useState(0)

  const handleTipoChange = (tipo: string | undefined) => {
    const newFilters = { ...filters, tipo }
    setFilters(newFilters)
    onFilterChange(newFilters)
    updateActiveCount(newFilters)
  }

  const handleDeudaChange = (conDeuda: boolean | undefined) => {
    const newFilters = { ...filters, conDeuda }
    setFilters(newFilters)
    onFilterChange(newFilters)
    updateActiveCount(newFilters)
  }

  const handleGastoChange = (field: 'desdeGasto' | 'hastaGasto', value?: number) => {
    const newFilters = { ...filters, [field]: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
    updateActiveCount(newFilters)
  }

  const handleFechaChange = (field: 'desdeRecha' | 'hastaFecha', value?: string) => {
    const newFilters = { ...filters, [field]: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
    updateActiveCount(newFilters)
  }

  const updateActiveCount = (filterState: FilterState) => {
    let count = 0
    if (filterState.tipo) count++
    if (filterState.conDeuda !== undefined) count++
    if (filterState.desdeGasto || filterState.hastaGasto) count++
    if (filterState.desdeRecha || filterState.hastaFecha) count++
    setActiveCount(count)
  }

  const handleReset = () => {
    setFilters({})
    setActiveCount(0)
    onFilterChange({})
  }

  return (
    <div className={className}>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 text-sm font-medium text-zinc-700"
        >
          <ChevronDown className="w-4 h-4" />
          Filtros
          {activeCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
              {activeCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute top-full mt-2 left-0 bg-white border border-zinc-200 rounded-lg shadow-lg p-4 min-w-64 z-50">
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Tipo de Cliente
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="tipo"
                    value=""
                    checked={!filters.tipo}
                    onChange={() => handleTipoChange(undefined)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="ml-2 text-sm text-zinc-700">Todos</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="tipo"
                    value="persona"
                    checked={filters.tipo === 'persona'}
                    onChange={() => handleTipoChange('persona')}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="ml-2 text-sm text-zinc-700">Persona</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="tipo"
                    value="empresa"
                    checked={filters.tipo === 'empresa'}
                    onChange={() => handleTipoChange('empresa')}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="ml-2 text-sm text-zinc-700">Empresa</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="tipo"
                    value="anonimo"
                    checked={filters.tipo === 'anonimo'}
                    onChange={() => handleTipoChange('anonimo')}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="ml-2 text-sm text-zinc-700">Anónimo</span>
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Estado de Cuenta
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="deuda"
                    checked={filters.conDeuda === undefined}
                    onChange={() => handleDeudaChange(undefined)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="ml-2 text-sm text-zinc-700">Todos</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="deuda"
                    checked={filters.conDeuda === true}
                    onChange={() => handleDeudaChange(true)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="ml-2 text-sm text-zinc-700">Con deuda</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="deuda"
                    checked={filters.conDeuda === false}
                    onChange={() => handleDeudaChange(false)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="ml-2 text-sm text-zinc-700">Sin deuda</span>
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Rango de Gasto
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Desde"
                  value={filters.desdeGasto || ''}
                  onChange={(e) => handleGastoChange('desdeGasto', e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="flex-1 px-3 py-2 border border-zinc-200 rounded text-sm"
                />
                <input
                  type="number"
                  placeholder="Hasta"
                  value={filters.hastaGasto || ''}
                  onChange={(e) => handleGastoChange('hastaGasto', e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="flex-1 px-3 py-2 border border-zinc-200 rounded text-sm"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Rango de Fecha
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={filters.desdeRecha || ''}
                  onChange={(e) => handleFechaChange('desdeRecha', e.target.value || undefined)}
                  className="flex-1 px-3 py-2 border border-zinc-200 rounded text-sm"
                />
                <input
                  type="date"
                  value={filters.hastaFecha || ''}
                  onChange={(e) => handleFechaChange('hastaFecha', e.target.value || undefined)}
                  className="flex-1 px-3 py-2 border border-zinc-200 rounded text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-zinc-200">
              {activeCount > 0 && (
                <button
                  onClick={handleReset}
                  className="flex-1 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 rounded border border-zinc-200"
                >
                  Limpiar
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 px-3 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Aplicar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
