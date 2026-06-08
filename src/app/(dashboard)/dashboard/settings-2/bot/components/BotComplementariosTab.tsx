'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface Complementario {
  id: string
  producto_id: string
}

export default function BotComplementariosTab() {
  const [items, setItems] = useState<Complementario[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/bot/complementarios')
        if (res.ok) {
          setItems(await res.json())
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <div className="text-sm text-zinc-500 py-8 text-center">Cargando...</div>

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-zinc-900">Productos Complementarios</h3>
          <p className="text-xs text-zinc-500 mt-1">El bot recomendará estos productos como complementos</p>
        </div>
        <button className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition">
          <Plus className="w-4 h-4" />
          Agregar
        </button>
      </div>

      {items.length === 0 ? (
        <div className="p-12 text-center border border-zinc-200 rounded-xl bg-zinc-50">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-200 mb-3">
            <Plus className="w-5 h-5 text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-600 font-medium">No hay productos configurados</p>
          <p className="text-xs text-zinc-500 mt-1">Agrega productos que el bot sugerirá como complementos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div
              key={item.id}
              className="flex items-center justify-between p-5 border border-zinc-200 rounded-xl bg-white hover:border-indigo-200 hover:shadow-md transition group"
            >
              <div className="flex-1">
                <p className="text-sm font-semibold text-zinc-900 group-hover:text-indigo-700 transition">Producto {item.producto_id}</p>
                <p className="text-xs text-zinc-500 mt-1">Se recomienda en negociaciones</p>
              </div>
              <button
                className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition flex-shrink-0"
                title="Eliminar producto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
