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
        <div key={agente.id} className="p-4 border border-zinc-200 rounded-lg flex items-start gap-3">
          <input type="checkbox" defaultChecked className="mt-1 w-4 h-4 border-zinc-300 rounded" />
          <div>
            <p className="font-medium text-sm text-zinc-900">{agente.label}</p>
            <p className="text-xs text-zinc-600 mt-1">{agente.desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
