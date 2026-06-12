'use client'

import { useState, useEffect } from 'react'

const AGENTES = [
  { id: 'ventas', label: 'Agente de Ventas', desc: 'Recomendaciones de productos, cotizaciones y pedidos' },
  { id: 'comprobantes', label: 'Agente de Comprobantes', desc: 'Envío automático de boletas y facturas por WhatsApp' },
  { id: 'upsell', label: 'Agente de Upsell', desc: 'Sugerencias de productos complementarios en cada venta' },
  { id: 'crm', label: 'Agente CRM', desc: 'Registro de datos de clientes y seguimiento de oportunidades' },
]

export default function BotAgentesTab() {
  const [agentes, setAgentes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/bot/agentes')
        if (res.ok) {
          const data = await res.json()
          setAgentes(data.agentes || ['ventas', 'comprobantes', 'upsell', 'crm'])
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const toggle = (id: string) => {
    setAgentes(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await fetch('/api/settings-2/bot/agentes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentes }),
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-zinc-500 py-8 text-center">Cargando...</div>

  return (
    <div className="space-y-5 max-w-2xl">
      <p className="text-xs text-zinc-500">
        Activa o desactiva módulos de comportamiento del bot. Los agentes inactivos no procesarán ese tipo de intents.
      </p>

      <div className="space-y-3">
        {AGENTES.map(agente => {
          const activo = agentes.includes(agente.id)
          return (
            <label
              key={agente.id}
              className="p-5 border border-zinc-200 rounded-xl flex items-start gap-4 cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/30 transition group"
            >
              <input
                type="checkbox"
                checked={activo}
                onChange={() => toggle(agente.id)}
                className="mt-1 w-5 h-5 border-zinc-300 rounded accent-indigo-600 cursor-pointer flex-shrink-0"
              />
              <div className="flex-1">
                <p className="font-semibold text-sm text-zinc-900 group-hover:text-indigo-700 transition">{agente.label}</p>
                <p className="text-xs text-zinc-600 mt-1">{agente.desc}</p>
              </div>
              <div className={`flex-shrink-0 px-2.5 py-1 text-xs font-bold rounded-lg ${
                activo
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-zinc-100 text-zinc-500'
              }`}>
                {activo ? 'Activo' : 'Inactivo'}
              </div>
            </label>
          )
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full px-4 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed rounded-lg transition"
      >
        {isSaving ? '⏳ Guardando...' : '✓ Guardar configuración'}
      </button>
    </div>
  )
}
