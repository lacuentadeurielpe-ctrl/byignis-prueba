'use client'

import { useState, useEffect } from 'react'

interface ComportamientoData {
  bot_margen_minimo: number
  bot_debounce_ms: number
  bot_delay_respuesta_ms: number
  bot_autoclose_cotizacion: boolean
  timeout_intervencion_dueno: number
  timeout_sesion_minutos: number
  max_mensajes_contexto: number
  umbral_monto_negociacion: number | null
}

const DEFAULTS: ComportamientoData = {
  bot_margen_minimo: 0,
  bot_debounce_ms: 8000,
  bot_delay_respuesta_ms: 0,
  bot_autoclose_cotizacion: false,
  timeout_intervencion_dueno: 30,
  timeout_sesion_minutos: 60,
  max_mensajes_contexto: 10,
  umbral_monto_negociacion: null,
}

function Campo({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-zinc-900 mb-1">{label}</label>
      <p className="text-xs text-zinc-500 mb-3">{desc}</p>
      {children}
    </div>
  )
}

export default function BotComportamientoTab() {
  const [data, setData] = useState<ComportamientoData>(DEFAULTS)
  const [isSaving, setIsSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/bot/comportamiento')
        if (res.ok) {
          const json = await res.json()
          setData({ ...DEFAULTS, ...json })
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
      const res = await fetch('/api/settings-2/bot/comportamiento', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) setSavedAt(Date.now())
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-zinc-500 py-8 text-center">Cargando...</div>

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Tiempos ──────────────────────────────────────────────────── */}
      <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-5">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide text-indigo-600">Tiempos</h3>

        <Campo label="Debounce (milisegundos)" desc="Tiempo que el bot espera para agrupar mensajes seguidos del cliente antes de responder">
          <input
            type="number"
            min={0}
            value={data.bot_debounce_ms}
            onChange={e => setData({ ...data, bot_debounce_ms: parseInt(e.target.value) || 0 })}
            className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </Campo>

        <div className="pt-4 border-t border-zinc-100">
          <div className="flex items-start justify-between mb-1">
            <label className="block text-sm font-semibold text-zinc-900">Demora antes de responder</label>
            <span className="text-sm font-bold text-indigo-600">{(data.bot_delay_respuesta_ms / 1000).toFixed(1)}s</span>
          </div>
          <p className="text-xs text-zinc-500 mb-3">Simula el tiempo que tardaría una persona en escribir la respuesta, para que no se sienta instantáneo/robótico</p>
          <input
            type="range"
            min={0}
            max={8000}
            step={250}
            value={data.bot_delay_respuesta_ms}
            onChange={e => setData({ ...data, bot_delay_respuesta_ms: parseInt(e.target.value) })}
            className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>

        <div className="pt-4 border-t border-zinc-100">
          <Campo label="Timeout de intervención del dueño (minutos)" desc="Cuánto dura el control manual antes de que el bot retome la conversación automáticamente">
            <input
              type="number"
              min={1}
              value={data.timeout_intervencion_dueno}
              onChange={e => setData({ ...data, timeout_intervencion_dueno: parseInt(e.target.value) || 1 })}
              className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </Campo>
        </div>

        <div className="pt-4 border-t border-zinc-100">
          <Campo label="Timeout de sesión (minutos)" desc="Minutos de inactividad tras los cuales se considera que el cliente empieza una conversación nueva">
            <input
              type="number"
              min={1}
              value={data.timeout_sesion_minutos}
              onChange={e => setData({ ...data, timeout_sesion_minutos: parseInt(e.target.value) || 1 })}
              className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </Campo>
        </div>
      </div>

      {/* ── Catálogo / ventas ────────────────────────────────────────── */}
      <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-5">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide text-indigo-600">Catálogo y ventas</h3>

        <Campo label="Umbral de upsell (S/)" desc="Monto mínimo de cotización a partir del cual el bot puede sugerir productos complementarios">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-400">S/</span>
            <input
              type="number"
              min={0}
              value={data.bot_margen_minimo}
              onChange={e => setData({ ...data, bot_margen_minimo: parseFloat(e.target.value) || 0 })}
              className="w-full pl-9 pr-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </Campo>

        <div className="pt-4 border-t border-zinc-100">
          <Campo label="Monto para revisión manual (S/)" desc="Si el total de una cotización supera este monto, queda marcada para que el encargado confirme el precio antes de cerrar el pedido. Déjalo vacío para desactivar.">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-400">S/</span>
              <input
                type="number"
                min={0}
                placeholder="Sin límite"
                value={data.umbral_monto_negociacion ?? ''}
                onChange={e => setData({ ...data, umbral_monto_negociacion: e.target.value === '' ? null : parseFloat(e.target.value) })}
                className="w-full pl-9 pr-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </Campo>
        </div>

        <div className="pt-4 border-t border-zinc-100">
          <Campo label="Mensajes de contexto" desc="Cuántos mensajes de historial reciente se le envían al modelo para mantener contexto de la conversación">
            <input
              type="number"
              min={2}
              max={50}
              value={data.max_mensajes_contexto}
              onChange={e => setData({ ...data, max_mensajes_contexto: parseInt(e.target.value) || 2 })}
              className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </Campo>
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
              <span className="text-sm font-semibold text-zinc-900 group-hover:text-indigo-700 transition">Cierre natural post-cotización</span>
              <p className="text-xs text-zinc-500 mt-1">El bot agrega una frase de cierre ("¿lo armamos como pedido?") después de cada cotización</p>
            </div>
          </label>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full px-4 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed rounded-lg transition"
      >
        {isSaving ? '⏳ Guardando cambios...' : savedAt ? '✓ Guardado' : '✓ Guardar cambios'}
      </button>
    </div>
  )
}
