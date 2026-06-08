'use client'

import { useState, useEffect } from 'react'

export default function BotComportamientoTab() {
  const [data, setData] = useState({
    bot_margen_minimo: 5,
    bot_debounce_ms: 1000,
    bot_grace_period_min: 15,
    bot_autoclose_cotizacion: false,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/bot/comportamiento')
        if (res.ok) {
          setData(await res.json())
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
      await fetch('/api/settings-2/bot/comportamiento', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-zinc-500">Cargando...</div>

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">Margen Mínimo Negociable (%)</label>
        <input
          type="number"
          value={data.bot_margen_minimo}
          onChange={e => setData({ ...data, bot_margen_minimo: parseFloat(e.target.value) })}
          className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">Debounce (ms)</label>
        <input
          type="number"
          value={data.bot_debounce_ms}
          onChange={e => setData({ ...data, bot_debounce_ms: parseInt(e.target.value) })}
          className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">Grace Period (minutos)</label>
        <input
          type="number"
          value={data.bot_grace_period_min}
          onChange={e => setData({ ...data, bot_grace_period_min: parseInt(e.target.value) })}
          className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={data.bot_autoclose_cotizacion}
          onChange={e => setData({ ...data, bot_autoclose_cotizacion: e.target.checked })}
          className="w-4 h-4 border-zinc-300 rounded"
        />
        <span className="text-sm text-zinc-700">Auto-cerrar cotizaciones expiradas</span>
      </label>

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
