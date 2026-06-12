'use client'

import { useState, useEffect } from 'react'

const PERSONALIDADES = [
  { value: 'amigable_peruano', label: 'Amigable peruano', desc: 'Casual y cálido, usa expresiones locales' },
  { value: 'formal', label: 'Formal', desc: 'Profesional y respetuoso' },
  { value: 'casual', label: 'Casual', desc: 'Relajado y desenfadado' },
]

export default function BotPerfilTab() {
  const [nombre, setNombre] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [personalidad, setPersonalidad] = useState('amigable_peruano')
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
          setPersonalidad(data.bot_personalidad || 'amigable_peruano')
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
        body: JSON.stringify({
          bot_nombre: nombre,
          bot_instrucciones: instrucciones,
          bot_personalidad: personalidad,
        }),
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-zinc-500 py-8 text-center">Cargando...</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-5">
        <div>
          <label className="block text-sm font-semibold text-zinc-900 mb-3">Nombre del Bot</label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="ej: Vendedor IA, AtencionBot"
            className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className="text-xs text-zinc-500 mt-2">Este nombre aparecerá en las conversaciones de WhatsApp</p>
        </div>

        <div className="pt-4 border-t border-zinc-100">
          <label className="block text-sm font-semibold text-zinc-900 mb-3">Tono de comunicación</label>
          <div className="space-y-2">
            {PERSONALIDADES.map(p => (
              <label
                key={p.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                  personalidad === p.value
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                }`}
              >
                <input
                  type="radio"
                  name="personalidad"
                  value={p.value}
                  checked={personalidad === p.value}
                  onChange={() => setPersonalidad(p.value)}
                  className="mt-0.5 accent-indigo-600"
                />
                <div>
                  <p className="text-sm font-medium text-zinc-900">{p.label}</p>
                  <p className="text-xs text-zinc-500">{p.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-100">
          <label className="block text-sm font-semibold text-zinc-900 mb-3">Instrucciones adicionales</label>
          <textarea
            value={instrucciones}
            onChange={e => setInstrucciones(e.target.value)}
            placeholder="ej: Siempre ofrece el producto más económico primero. Menciona nuestras promociones de fin de mes. No ofreces crédito por WhatsApp."
            className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent h-32 resize-none"
          />
          <p className="text-xs text-zinc-500 mt-2">Reglas adicionales que el bot seguirá al responder a los clientes</p>
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
