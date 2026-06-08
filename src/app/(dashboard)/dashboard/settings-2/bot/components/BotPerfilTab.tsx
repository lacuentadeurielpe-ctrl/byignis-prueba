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

  if (loading) return <div className="text-sm text-zinc-500 py-8 text-center">Cargando...</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="p-5 bg-white border border-zinc-200 rounded-xl">
        <div className="mb-4">
          <label className="block text-sm font-semibold text-zinc-900 mb-3">Nombre del Bot</label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="ej: AsistenteFerrería, Vendedor IA"
            className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className="text-xs text-zinc-500 mt-2">Este nombre aparecerá en las conversaciones de WhatsApp</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-900 mb-3">Instrucciones Base</label>
          <textarea
            value={instrucciones}
            onChange={e => setInstrucciones(e.target.value)}
            placeholder="Escribe las instrucciones que guiarán el comportamiento del bot. Por ejemplo: eres un vendedor amable, responde en español, ofrece alternativas, etc."
            className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent h-40 resize-none"
          />
          <p className="text-xs text-zinc-500 mt-2">Estas instrucciones afectarán cómo responde el bot a los clientes</p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full px-4 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed rounded-lg transition"
      >
        {isSaving ? '⏳ Guardando cambios...' : '✓ Guardar cambios'}
      </button>
    </div>
  )
}
