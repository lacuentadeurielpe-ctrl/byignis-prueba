'use client'

// Selector de sucursal activa — visible solo con multi_sucursal activo.
// El dueño puede elegir "Todas" (consolidado) o una sucursal; un empleado
// con sucursal asignada ve un chip fijo no interactivo.

import { useState } from 'react'
import { Building2, Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import type { ContextoSucursal } from '@/lib/sucursales/contexto'

export default function SucursalSelector({ contexto }: { contexto: ContextoSucursal }) {
  const [abierto, setAbierto]     = useState(false)
  const [cambiando, setCambiando] = useState(false)

  if (!contexto.multiSucursal) return null

  const activo = contexto.localesVisibles.find(l => l.id === contexto.localActivoId) ?? null

  // Empleado fijado: chip informativo, sin dropdown
  if (contexto.localFijado) {
    return (
      <div className="mx-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 truncate">
          {activo?.nombre ?? 'Sucursal'}
        </span>
      </div>
    )
  }

  async function cambiar(localId: string | null) {
    setCambiando(true)
    try {
      const res = await fetch('/api/sucursales/activa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId }),
      })
      if (res.ok) window.location.reload()
      else setCambiando(false)
    } catch {
      setCambiando(false)
    }
  }

  return (
    <div className="relative mx-3 mb-1">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        disabled={cambiando}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                   bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800
                   text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 transition"
      >
        {cambiando
          ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-zinc-400" />
          : <Building2 className="w-3.5 h-3.5 shrink-0 text-zinc-400" />}
        <span className="truncate flex-1 text-left">
          {activo ? activo.nombre : 'Todas las sucursales'}
        </span>
        <ChevronsUpDown className="w-3 h-3 shrink-0 text-zinc-400" />
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl py-1 overflow-hidden">
            <button
              type="button"
              onClick={() => { setAbierto(false); cambiar(null) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left
                         text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span className="flex-1 truncate">Todas las sucursales</span>
              {contexto.localActivoId === null && <Check className="w-3.5 h-3.5 text-emerald-500" />}
            </button>
            <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
            {contexto.localesVisibles.map(local => (
              <button
                key={local.id}
                type="button"
                onClick={() => { setAbierto(false); cambiar(local.id) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left
                           text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span className="flex-1 truncate">
                  {local.nombre}
                  {local.es_principal && <span className="ml-1 text-[10px] text-zinc-400">(principal)</span>}
                </span>
                {contexto.localActivoId === local.id && <Check className="w-3.5 h-3.5 text-emerald-500" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
