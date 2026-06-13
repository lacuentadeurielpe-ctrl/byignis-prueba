'use client'

import { useState, useTransition } from 'react'
import { Package, Sparkles, Layers } from 'lucide-react'

type Modo = 'fisicos' | 'digitales' | 'ambos'

interface Option {
  value: Modo
  label: string
  description: string
  icon: React.ReactNode
}

const OPTIONS: Option[] = [
  {
    value: 'fisicos',
    label: 'Solo físicos',
    description: 'El bot busca únicamente en el catálogo de productos físicos',
    icon: <Package className="w-4 h-4" />,
  },
  {
    value: 'digitales',
    label: 'Solo digitales',
    description: 'El bot busca únicamente en productos digitales',
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    value: 'ambos',
    label: 'Ambos',
    description: 'El bot busca en físicos primero y luego en digitales',
    icon: <Layers className="w-4 h-4" />,
  },
]

export default function CatalogBotModeBar({ initialMode }: { initialMode: Modo }) {
  const [modo, setModo] = useState<Modo>(initialMode)
  const [pending, startTransition] = useTransition()

  function handleSelect(value: Modo) {
    if (value === modo || pending) return
    const previous = modo
    setModo(value)

    startTransition(async () => {
      const res = await fetch('/api/settings-2/catalogo/bot-mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: value }),
      })
      if (!res.ok) setModo(previous)
    })
  }

  return (
    <div className="mb-6 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Modo de búsqueda del bot WhatsApp
        </span>
        {pending && (
          <span className="w-3 h-3 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {OPTIONS.map((opt) => {
          const active = modo === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              disabled={pending}
              title={opt.description}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                active
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 hover:text-zinc-900'
              } ${pending ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {opt.icon}
              {opt.label}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        {OPTIONS.find((o) => o.value === modo)?.description ?? ''}
      </p>
    </div>
  )
}
