'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, ChevronDown } from 'lucide-react'

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
  const actual = searchParams.get('p') ?? 'hoy'

  return (
    <div className="relative group">
      <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 shadow-sm transition hover:border-zinc-300 dark:hover:border-zinc-700 focus-within:ring-2 focus-within:ring-zinc-900 focus-within:border-zinc-900 dark:focus-within:ring-zinc-100 dark:focus-within:border-zinc-100">
        <Calendar className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
        <select
          value={actual}
          onChange={(e) => router.push(`/dashboard?p=${e.target.value}`)}
          className="appearance-none bg-transparent border-none text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-0 pr-6 cursor-pointer w-full"
        >
          {PERIODOS.map(({ value, label }) => (
            <option key={value} value={value} className="text-zinc-900 bg-white">
              {label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 pointer-events-none group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" />
      </div>
    </div>
  )
}
