'use client'

/**
 * Pestaña "Agenda" del portal del repartidor: ve los bloques del día con sus
 * ventanas, confirma/ajusta cada una, mantiene su duración de bloque promedio
 * y agrupa entregas en un viaje. El repartidor es la autoridad de la estimación.
 */

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Check, Clock, Pencil, Save, Layers, X } from 'lucide-react'
import { formatearVentanaISO } from '@/lib/delivery/agenda/ventanas'

interface Bloque {
  entregaId: string
  pedidoId: string
  numeroPedido: string
  estado: string
  ventanaInicio: string
  ventanaFin: string
  origen: string
  confirmada: boolean
  viajeId: string | null
  posicion: number | null
}

interface AgendaData {
  duracionBloqueDefaultMin: number
  promedioRealMin: number | null
  promedioRealMuestras: number
  bloques: Bloque[]
}

const hoyLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })

function horaInputDeISO(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Lima',
  })
}

function isoDeHoraInput(hhmm: string): string {
  return new Date(`${hoyLima}T${hhmm}:00-05:00`).toISOString()
}

export default function AgendaTab({ token }: { token: string }) {
  const [data, setData] = useState<AgendaData | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [editInicio, setEditInicio] = useState('')
  const [editFin, setEditFin] = useState('')
  const [promedioInput, setPromedioInput] = useState('')
  const [guardandoPromedio, setGuardandoPromedio] = useState(false)
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [agrupando, setAgrupando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch(`/api/delivery/${token}/agenda`)
      if (res.ok) {
        const d: AgendaData = await res.json()
        setData(d)
        setPromedioInput(String(d.duracionBloqueDefaultMin))
      }
    } finally {
      setCargando(false)
    }
  }, [token])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function confirmar(entregaId: string) {
    setGuardandoId(entregaId)
    try {
      await fetch(`/api/delivery/${token}/agenda/ventana`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entregaId, accion: 'confirmar' }),
      })
      await cargar()
    } finally {
      setGuardandoId(null)
    }
  }

  function abrirEdicion(b: Bloque) {
    setEditando(b.entregaId)
    setEditInicio(horaInputDeISO(b.ventanaInicio))
    setEditFin(horaInputDeISO(b.ventanaFin))
  }

  async function guardarAjuste(entregaId: string) {
    if (!editInicio || !editFin || editFin <= editInicio) return
    setGuardandoId(entregaId)
    try {
      await fetch(`/api/delivery/${token}/agenda/ventana`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entregaId,
          accion: 'ajustar',
          inicio: isoDeHoraInput(editInicio),
          fin: isoDeHoraInput(editFin),
        }),
      })
      setEditando(null)
      await cargar()
    } finally {
      setGuardandoId(null)
    }
  }

  async function guardarPromedio() {
    const min = Number(promedioInput)
    if (!Number.isFinite(min) || min <= 0) return
    setGuardandoPromedio(true)
    try {
      await fetch(`/api/delivery/${token}/agenda/promedio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutos: min }),
      })
      await cargar()
    } finally {
      setGuardandoPromedio(false)
    }
  }

  function toggleSeleccion(entregaId: string) {
    setSeleccion((prev) =>
      prev.includes(entregaId) ? prev.filter((id) => id !== entregaId) : [...prev, entregaId],
    )
  }

  async function agrupar() {
    if (seleccion.length < 2) return
    setAgrupando(true)
    try {
      await fetch(`/api/delivery/${token}/agenda/agrupar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entregaIds: seleccion }),
      })
      setSeleccion([])
      await cargar()
    } finally {
      setAgrupando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!data) {
    return <p className="text-center text-sm text-zinc-400 py-16">No se pudo cargar la agenda</p>
  }

  return (
    <div className="space-y-3">
      {/* Promedio del repartidor */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-zinc-500" />
          <p className="text-sm font-semibold text-zinc-800">Mi tiempo por entrega</p>
        </div>
        <p className="text-xs text-zinc-500 mb-3">
          Con esto se calcula la hora del siguiente pedido. Ajústalo a tu ritmo real.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={5}
            max={240}
            value={promedioInput}
            onChange={(e) => setPromedioInput(e.target.value)}
            className="w-20 px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-sm text-zinc-500">min</span>
          <button
            onClick={guardarPromedio}
            disabled={guardandoPromedio}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
          >
            {guardandoPromedio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar
          </button>
        </div>
        {data.promedioRealMin != null && (
          <p className="text-xs text-zinc-400 mt-2">
            Tu promedio real ({data.promedioRealMuestras} entregas esta semana):{' '}
            <span className="font-semibold text-zinc-600">{data.promedioRealMin} min</span>
          </p>
        )}
      </div>

      {/* Barra de agrupación */}
      {seleccion.length >= 2 && (
        <div className="sticky top-2 z-10 bg-indigo-600 text-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
          <Layers className="w-4 h-4" />
          <span className="text-sm font-medium flex-1">{seleccion.length} entregas en un viaje</span>
          <button onClick={() => setSeleccion([])} className="text-indigo-100 hover:text-white">
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={agrupar}
            disabled={agrupando}
            className="bg-white text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {agrupando ? 'Agrupando...' : 'Agrupar'}
          </button>
        </div>
      )}

      {/* Bloques */}
      {data.bloques.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium">Sin entregas en tu agenda hoy</p>
        </div>
      ) : (
        data.bloques.map((b) => {
          const editandoEste = editando === b.entregaId
          const seleccionado = seleccion.includes(b.entregaId)
          return (
            <div
              key={b.entregaId}
              className={`bg-white rounded-2xl border p-4 transition ${
                seleccionado ? 'border-indigo-400 ring-1 ring-indigo-200' : 'border-zinc-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={seleccionado}
                  onChange={() => toggleSeleccion(b.entregaId)}
                  className="w-4 h-4 accent-indigo-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-900">{b.numeroPedido}</span>
                    {b.viajeId && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Layers className="w-2.5 h-2.5" /> Viaje · parada {b.posicion}
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${
                        b.confirmada
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {formatearVentanaISO(b.ventanaInicio, b.ventanaFin)}
                      {!b.confirmada && <span className="opacity-60">· provisional</span>}
                    </span>
                  </div>
                </div>
              </div>

              {editandoEste ? (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="time"
                    value={editInicio}
                    onChange={(e) => setEditInicio(e.target.value)}
                    className="px-2 py-1.5 border border-zinc-200 rounded-lg text-sm"
                  />
                  <span className="text-zinc-400">–</span>
                  <input
                    type="time"
                    value={editFin}
                    onChange={(e) => setEditFin(e.target.value)}
                    className="px-2 py-1.5 border border-zinc-200 rounded-lg text-sm"
                  />
                  <button
                    onClick={() => guardarAjuste(b.entregaId)}
                    disabled={guardandoId === b.entregaId}
                    className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    {guardandoId === b.entregaId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Guardar
                  </button>
                  <button onClick={() => setEditando(null)} className="p-1.5 text-zinc-400 hover:text-zinc-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => confirmar(b.entregaId)}
                    disabled={b.confirmada || guardandoId === b.entregaId}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition"
                  >
                    {guardandoId === b.entregaId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    {b.confirmada ? 'Confirmada' : 'Confirmar'}
                  </button>
                  <button
                    onClick={() => abrirEdicion(b)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold transition"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Ajustar hora
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
