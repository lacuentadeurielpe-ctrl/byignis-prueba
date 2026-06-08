'use client'

import { useState, useCallback } from 'react'
import { Search, X } from 'lucide-react'

interface ClientesSearchProps {
  onSearch: (query: string) => void
  placeholder?: string
  className?: string
}

export default function ClientesSearch({
  onSearch,
  placeholder = 'Buscar por nombre, teléfono, DNI/RUC, alias...',
  className = '',
}: ClientesSearchProps) {
  const [search, setSearch] = useState('')

  const handleChange = useCallback((value: string) => {
    setSearch(value)
    onSearch(value)
  }, [onSearch])

  const handleClear = useCallback(() => {
    setSearch('')
    onSearch('')
  }, [onSearch])

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        {search && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
