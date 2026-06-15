'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, Check } from 'lucide-react'

const PERIODOS = [
  { value: 'hoy',          label: 'Hoy' },
  { value: 'ayer',         label: 'Ayer' },
  { value: 'semana',       label: 'Esta semana' },
  { value: 'mes',          label: 'Este mes' },
  { value: 'mes_anterior', label: 'Mes anterior' },
  { value: '30d',          label: 'Últimos 30 días' },
  { value: 'trimestre',    label: 'Este trimestre' },
]

export default function PeriodSelector() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const actual = searchParams.get('p') ?? 'semana'
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const labelActual = PERIODOS.find(p => p.value === actual)?.label ?? 'Esta semana'

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
      >
        <Calendar className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
        <span>{labelActual}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg overflow-hidden z-50 py-1">
          {PERIODOS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => {
                router.push(`/dashboard?p=${value}`)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors ${
                actual === value
                  ? 'bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {label}
              {actual === value && <Check className="w-3.5 h-3.5 shrink-0 text-zinc-900 dark:text-zinc-100" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
