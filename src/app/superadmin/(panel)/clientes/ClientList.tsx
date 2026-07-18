'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Store, Building2, Calendar } from 'lucide-react'
import dayjs from 'dayjs'

interface Cliente {
  id: string
  nombre: string
  email: string
  telefono_whatsapp: string
  created_at: string
  estado: string
}

export default function ClientList({ clientes }: { clientes: Cliente[] }) {
  const [search, setSearch] = useState('')

  const filtered = clientes.filter(c => 
    c.nombre?.toLowerCase().includes(search.toLowerCase()) || 
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.telefono_whatsapp?.includes(search)
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-gray-400 text-sm">Gestiona todas las cuentas de Uintegrus</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80 pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(cliente => {
          const isActive = cliente.estado === 'activo'
          return (
            <Link 
              key={cliente.id} 
              href={`/superadmin/clientes/${cliente.id}`}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all flex flex-col gap-4 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center group-hover:bg-blue-500/10 transition-colors">
                    <Store className="w-5 h-5 text-gray-400 group-hover:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium line-clamp-1">{cliente.nombre}</h3>
                    <p className="text-gray-400 text-xs truncate max-w-[150px]">{cliente.email}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-md text-xs font-medium ${isActive ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {isActive ? 'Pro' : 'Inactivo'}
                </span>
              </div>
              
              <div className="pt-4 border-t border-gray-800 grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <Building2 className="w-4 h-4" />
                  <span className="truncate">{cliente.telefono_whatsapp || 'Sin teléfono'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400 justify-end">
                  <Calendar className="w-4 h-4" />
                  <span>{dayjs(cliente.created_at).format('DD MMM, YYYY')}</span>
                </div>
              </div>
            </Link>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500">
            No se encontraron clientes que coincidan con la búsqueda.
          </div>
        )}
      </div>
    </div>
  )
}
