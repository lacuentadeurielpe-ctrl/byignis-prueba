'use client'

const AGENTES = [
  { id: 'ventas', label: 'Agente de Ventas', desc: 'Recomendaciones de productos' },
  { id: 'soporte', label: 'Agente de Soporte', desc: 'Respuesta a dudas' },
  { id: 'entregas', label: 'Agente de Entregas', desc: 'Estado de pedidos' },
  { id: 'promociones', label: 'Agente de Promociones', desc: 'Ofertas especiales' },
]

export default function BotAgentesTab() {
  return (
    <div className="space-y-3">
      {AGENTES.map(agente => (
        <label
          key={agente.id}
          className="p-5 border border-zinc-200 rounded-xl flex items-start gap-4 cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/30 transition group"
        >
          <input
            type="checkbox"
            defaultChecked
            className="mt-1 w-5 h-5 border-zinc-300 rounded accent-indigo-600 cursor-pointer flex-shrink-0"
          />
          <div className="flex-1">
            <p className="font-semibold text-sm text-zinc-900 group-hover:text-indigo-700 transition">{agente.label}</p>
            <p className="text-xs text-zinc-600 mt-2">{agente.desc}</p>
          </div>
          <div className="flex-shrink-0 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg">Activo</div>
        </label>
      ))}
    </div>
  )
}
