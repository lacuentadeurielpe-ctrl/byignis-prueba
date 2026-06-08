'use client'

import { useState, useEffect } from 'react'

export default function BotPerfilTab() {
  const [nombre, setNombre] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/bot/perfil')
        if (res.ok) {
          const data = await res.json()
          setNombre(data.bot_nombre || '')
          setInstrucciones(data.bot_instrucciones || '')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await fetch('/api/settings-2/bot/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_nombre: nombre, bot_instrucciones: instrucciones }),
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-zinc-500">Cargando...</div>

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">Nombre del Bot</label>
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="ej: AsistenteFerrería"
          className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">Instrucciones Base</label>
        <textarea
          value={instrucciones}
          onChange={e => setInstrucciones(e.target.value)}
          placeholder="Define el comportamiento del bot..."
          className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm h-32"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg disabled:opacity-50"
      >
        {isSaving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  )
}
