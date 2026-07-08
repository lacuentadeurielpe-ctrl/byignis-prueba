'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { Store, ChevronDown, Check } from 'lucide-react'

export default function SucursalSelector({ locales = [] }: { locales: any[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const actual = searchParams.get('s') || ''
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const labelActual = locales.find(l => l.id === actual)?.nombre ?? 'Todas las sucursales'

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (locales.length === 0) return null

  const handleSelect = (val: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (val) {
      params.set('s', val)
    } else {
      params.delete('s')
    }
    router.push(`${pathname}?${params.toString()}`)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
      >
        <Store className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
        <span>{labelActual}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg overflow-hidden z-50 py-1">
          <button
            onClick={() => handleSelect('')}
            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors ${
              actual === ''
                ? 'bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Todas las sucursales
            {actual === '' && <Check className="w-3.5 h-3.5 shrink-0 text-zinc-900 dark:text-zinc-100" />}
          </button>
          
          {locales.map(({ id, nombre }) => (
            <button
              key={id}
              onClick={() => handleSelect(id)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors ${
                actual === id
                  ? 'bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {nombre}
              {actual === id && <Check className="w-3.5 h-3.5 shrink-0 text-zinc-900 dark:text-zinc-100" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
