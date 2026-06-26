'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Send, Plus, Users, CheckCircle2, XCircle, Clock, Play,
  MessageSquare, ChevronRight, AlertCircle, Loader2, Trash2,
} from 'lucide-react'

interface Plantilla {
  id: string
  nombre: string
  meta_status: string
  categoria: string
}

interface Campana {
  id: string
  nombre: string
  estado: 'borrador' | 'programada' | 'enviando' | 'completada' | 'cancelada'
  total_destinos: number
  total_enviados: number
  total_errores: number
  programada_at: string | null
  completada_at: string | null
  created_at: string
  plantillas_wa?: Plantilla | null
  mensaje_libre?: string | null
}

const ESTADO_BADGE: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  borrador:   { label: 'Borrador',   className: 'bg-zinc-100 text-zinc-600',   icon: <Clock className="w-3 h-3" /> },
  programada: { label: 'Programada', className: 'bg-blue-100 text-blue-700',   icon: <Clock className="w-3 h-3" /> },
  enviando:   { label: 'Enviando',   className: 'bg-amber-100 text-amber-700', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  completada: { label: 'Completada', className: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelada:  { label: 'Cancelada',  className: 'bg-red-100 text-red-700',     icon: <XCircle className="w-3 h-3" /> },
}

interface Props {
  campanasIniciales: Campana[]
  plantillas: Plantilla[]
}

export default function DifusionesClient({ campanasIniciales, plantillas }: Props) {
  const [campanas,   setCampanas]   = useState<Campana[]>(campanasIniciales)
  const [showNueva,  setShowNueva]  = useState(false)
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  // Formulario nueva campaña
  const [form, setForm] = useState({
    nombre: '',
    plantilla_id: '',
    mensaje_libre: '',
    filtro_tipo: '',
    acepta_mkt_only: true,
  })

  async function crearCampana() {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    if (!form.plantilla_id && !form.mensaje_libre.trim()) {
      setError('Elige una plantilla o escribe un mensaje libre')
      return
    }
    setError(null)

    const res = await fetch('/api/campanas', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        nombre:          form.nombre.trim(),
        plantilla_id:    form.plantilla_id || null,
        mensaje_libre:   form.mensaje_libre.trim() || null,
        filtro_tipo:     form.filtro_tipo || null,
        acepta_mkt_only: form.acepta_mkt_only,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Error al crear')
      return
    }
    const nueva = await res.json()
    setCampanas(prev => [nueva, ...prev])
    setShowNueva(false)
    setForm({ nombre: '', plantilla_id: '', mensaje_libre: '', filtro_tipo: '', acepta_mkt_only: true })
  }

  async function enviarCampana(id: string) {
    if (!confirm('¿Iniciar el envío a todos los destinatarios?')) return
    setEnviandoId(id)
    try {
      const res = await fetch(`/api/campanas/${id}/enviar`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al enviar'); return }
      setCampanas(prev => prev.map(c =>
        c.id === id
          ? { ...c, estado: 'completada', total_enviados: data.enviados, total_errores: data.errores }
          : c
      ))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setEnviandoId(null)
    }
  }

  async function eliminarCampana(id: string) {
    if (!confirm('¿Eliminar esta campaña?')) return
    const res = await fetch(`/api/campanas/${id}`, { method: 'DELETE' })
    if (res.ok) setCampanas(prev => prev.filter(c => c.id !== id))
    else {
      const data = await res.json()
      setError(data.error ?? 'Error al eliminar')
    }
  }

  function formatDate(s: string | null) {
    if (!s) return ''
    return new Date(s).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="p-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-950">Difusiones</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Envía mensajes masivos a tus contactos por WhatsApp</p>
        </div>
        <button
          onClick={() => setShowNueva(true)}
          className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-zinc-800 transition"
        >
          <Plus className="w-4 h-4" />
          Nueva campaña
        </button>
      </div>

      {/* Alerta */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {/* Banner reglas WhatsApp */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Regla de la ventana de 24h de WhatsApp</p>
          <p>Solo puedes enviar mensajes libres a contactos que te hayan escrito en las últimas 24h. Para contactos fuera de esa ventana, debes usar una <strong>plantilla aprobada</strong> por Meta.</p>
        </div>
      </div>

      {/* Formulario nueva campaña */}
      {showNueva && (
        <div className="mb-6 p-5 border border-zinc-200 rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-zinc-900">Nueva campaña</h2>
            <button onClick={() => setShowNueva(false)} className="text-zinc-400 hover:text-zinc-700">
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-700 block mb-1">Nombre de la campaña *</label>
              <input
                type="text"
                value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: Promoción de julio"
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 block mb-1">Plantilla aprobada (recomendado)</label>
              <select
                value={form.plantilla_id}
                onChange={e => setForm(p => ({ ...p, plantilla_id: e.target.value }))}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">Sin plantilla (mensaje libre)</option>
                {plantillas.filter(p => p.meta_status === 'aprobada').map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              {plantillas.filter(p => p.meta_status === 'aprobada').length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No tienes plantillas aprobadas. Créalas en <a href="/dashboard/plantillas-wa" className="underline">Plantillas WA</a>.</p>
              )}
            </div>

            {!form.plantilla_id && (
              <div>
                <label className="text-xs font-medium text-zinc-700 block mb-1">Mensaje libre (solo dentro de ventana 24h)</label>
                <textarea
                  value={form.mensaje_libre}
                  onChange={e => setForm(p => ({ ...p, mensaje_libre: e.target.value }))}
                  placeholder="Escribe el mensaje que recibirán…"
                  rows={3}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-700 block mb-1">Tipo de contacto</label>
                <select
                  value={form.filtro_tipo}
                  onChange={e => setForm(p => ({ ...p, filtro_tipo: e.target.value }))}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  <option value="">Todos</option>
                  <option value="persona">Solo personas</option>
                  <option value="empresa">Solo empresas</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700 block mb-1">Marketing</label>
                <label className="flex items-center gap-2 border border-zinc-200 rounded-xl px-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.acepta_mkt_only}
                    onChange={e => setForm(p => ({ ...p, acepta_mkt_only: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-zinc-700">Solo acepta marketing</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNueva(false)}
                className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={crearCampana}
                className="px-4 py-2 text-sm bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition font-medium"
              >
                Crear campaña
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista campañas */}
      {campanas.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <Send className="w-10 h-10 mx-auto mb-3 text-zinc-200" />
          <p className="text-sm font-medium">Sin campañas aún</p>
          <p className="text-xs mt-1">Crea tu primera campaña de difusión</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campanas.map((c) => {
            const badge   = ESTADO_BADGE[c.estado] ?? ESTADO_BADGE.borrador
            const tasaEnv = c.total_destinos > 0 ? Math.round((c.total_enviados / c.total_destinos) * 100) : 0
            const isEnv   = enviandoId === c.id

            return (
              <div key={c.id} className="p-4 bg-white border border-zinc-200 rounded-2xl hover:border-zinc-300 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-zinc-900 truncate">{c.nombre}</p>
                      <span className={cn('flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full', badge.className)}>
                        {badge.icon}
                        {badge.label}
                      </span>
                    </div>
                    {c.plantillas_wa && (
                      <p className="text-xs text-zinc-500 mt-0.5">Plantilla: {c.plantillas_wa.nombre}</p>
                    )}
                    {c.mensaje_libre && (
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">{c.mensaje_libre}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-zinc-400">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{c.total_destinos} destinos</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />{c.total_enviados} enviados</span>
                      {c.total_errores > 0 && (
                        <span className="flex items-center gap-1 text-red-500"><XCircle className="w-3.5 h-3.5" />{c.total_errores} fallidos</span>
                      )}
                      <span>{formatDate(c.created_at)}</span>
                    </div>
                    {/* Barra de progreso */}
                    {(c.estado === 'enviando' || c.estado === 'completada') && c.total_destinos > 0 && (
                      <div className="mt-2 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${tasaEnv}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {(c.estado === 'borrador' || c.estado === 'programada') && (
                      <button
                        onClick={() => enviarCampana(c.id)}
                        disabled={isEnv}
                        className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl font-medium transition disabled:opacity-50"
                      >
                        {isEnv
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Play className="w-3.5 h-3.5" />
                        }
                        {isEnv ? 'Enviando…' : 'Enviar ahora'}
                      </button>
                    )}
                    {c.estado !== 'enviando' && (
                      <button
                        onClick={() => eliminarCampana(c.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
