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

  if (loading) return <div className="text-sm text-zinc-500 py-8 text-center">Cargando...</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-5">
        <div>
          <div className="flex items-start justify-between mb-3">
            <div>
              <label className="block text-sm font-semibold text-zinc-900">Margen Mínimo Negociable</label>
              <p className="text-xs text-zinc-500 mt-1">Descuento mínimo que puede ofrecer el bot</p>
            </div>
            <span className="text-xl font-bold text-indigo-600">{data.bot_margen_minimo}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={data.bot_margen_minimo}
            onChange={e => setData({ ...data, bot_margen_minimo: parseFloat(e.target.value) })}
            className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>

        <div className="pt-4 border-t border-zinc-100">
          <label className="block text-sm font-semibold text-zinc-900 mb-3">Debounce (milisegundos)</label>
          <p className="text-xs text-zinc-500 mb-3">Tiempo de espera antes de procesar mensaje</p>
          <input
            type="number"
            value={data.bot_debounce_ms}
            onChange={e => setData({ ...data, bot_debounce_ms: parseInt(e.target.value) })}
            className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="pt-4 border-t border-zinc-100">
          <label className="block text-sm font-semibold text-zinc-900 mb-3">Grace Period (minutos)</label>
          <p className="text-xs text-zinc-500 mb-3">Tiempo antes de que expire una cotización</p>
          <input
            type="number"
            value={data.bot_grace_period_min}
            onChange={e => setData({ ...data, bot_grace_period_min: parseInt(e.target.value) })}
            className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="pt-4 border-t border-zinc-100">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={data.bot_autoclose_cotizacion}
              onChange={e => setData({ ...data, bot_autoclose_cotizacion: e.target.checked })}
              className="w-5 h-5 border-zinc-300 rounded accent-indigo-600 cursor-pointer flex-shrink-0"
            />
            <div className="flex-1">
              <span className="text-sm font-semibold text-zinc-900 group-hover:text-indigo-700 transition">Auto-cerrar cotizaciones expiradas</span>
              <p className="text-xs text-zinc-500 mt-1">Cierra automáticamente las cotizaciones después del grace period</p>
            </div>
          </label>
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
