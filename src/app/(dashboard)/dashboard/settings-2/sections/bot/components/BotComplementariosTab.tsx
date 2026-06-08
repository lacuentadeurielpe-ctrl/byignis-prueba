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

  if (loading) return <div className="text-sm text-zinc-500">Cargando...</div>

  return (
    <div className="space-y-4">
      <button className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg flex items-center gap-2">
        <Plus className="w-4 h-4" />
        Agregar Producto
      </button>

      {items.length === 0 ? (
        <div className="p-8 text-center text-zinc-500">
          <p>No hay productos configurados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 border border-zinc-200 rounded-lg">
              <span className="text-sm text-zinc-900">Producto {item.producto_id}</span>
              <button className="p-1 text-rose-600 hover:bg-rose-50 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
