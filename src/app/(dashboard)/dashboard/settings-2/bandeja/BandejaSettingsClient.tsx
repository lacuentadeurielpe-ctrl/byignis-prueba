'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Plus, Trash2, Edit3, Check, X, Tag, Zap } from 'lucide-react'

interface Etiqueta {
  id: string
  nombre: string
  color: string
  orden: number
}

interface RespuestaRapida {
  id: string
  atajo: string
  contenido: string
  categoria: string | null
  orden: number
}

const COLORES_PRESET = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#64748b', '#71717a',
]

interface Props {
  etiquetasIniciales:  Etiqueta[]
  respuestasIniciales: RespuestaRapida[]
}

export default function BandejaSettingsClient({ etiquetasIniciales, respuestasIniciales }: Props) {
  const [etiquetas,  setEtiquetas]  = useState<Etiqueta[]>(etiquetasIniciales)
  const [respuestas, setRespuestas] = useState<RespuestaRapida[]>(respuestasIniciales)
  const [tab,        setTab]        = useState<'etiquetas' | 'rapidas'>('etiquetas')
  const [error,      setError]      = useState<string | null>(null)
  const [success,    setSuccess]    = useState<string | null>(null)

  // ── Etiquetas ──────────────────────────────────────────────────────────────
  const [nuevaEt, setNuevaEt] = useState({ nombre: '', color: COLORES_PRESET[0] })
  const [creandoEt, setCreandoEt] = useState(false)

  async function crearEtiqueta() {
    if (!nuevaEt.nombre.trim()) return
    setCreandoEt(true)
    setError(null)
    try {
      const res = await fetch('/api/etiquetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevaEt.nombre.trim(), color: nuevaEt.color }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      const nueva = await res.json()
      setEtiquetas(prev => [...prev, nueva])
      setNuevaEt({ nombre: '', color: COLORES_PRESET[0] })
      setSuccess('Etiqueta creada')
      setTimeout(() => setSuccess(null), 2000)
    } finally {
      setCreandoEt(false)
    }
  }

  async function eliminarEtiqueta(id: string) {
    if (!confirm('¿Eliminar esta etiqueta?')) return
    await fetch(`/api/etiquetas/${id}`, { method: 'DELETE' })
    setEtiquetas(prev => prev.filter(e => e.id !== id))
  }

  // ── Respuestas rápidas ─────────────────────────────────────────────────────
  const [nuevaRR, setNuevaRR] = useState({ atajo: '', contenido: '', categoria: '' })
  const [creandoRR, setCreandoRR] = useState(false)

  async function crearRespuesta() {
    if (!nuevaRR.atajo.trim() || !nuevaRR.contenido.trim()) return
    setCreandoRR(true)
    setError(null)
    try {
      const res = await fetch('/api/respuestas-rapidas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          atajo:    nuevaRR.atajo.trim().replace(/\//g, '').toLowerCase(),
          contenido: nuevaRR.contenido.trim(),
          categoria: nuevaRR.categoria.trim() || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      const nueva = await res.json()
      setRespuestas(prev => [...prev, nueva])
      setNuevaRR({ atajo: '', contenido: '', categoria: '' })
      setSuccess('Respuesta rápida creada')
      setTimeout(() => setSuccess(null), 2000)
    } finally {
      setCreandoRR(false)
    }
  }

  async function eliminarRespuesta(id: string) {
    if (!confirm('¿Eliminar esta respuesta rápida?')) return
    await fetch(`/api/respuestas-rapidas/${id}`, { method: 'DELETE' })
    setRespuestas(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { id: 'etiquetas', label: 'Etiquetas', icon: <Tag className="w-4 h-4" /> },
          { id: 'rapidas',   label: 'Respuestas rápidas', icon: <Zap className="w-4 h-4" /> },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition',
              tab === t.id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Mensajes */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <X className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
          <Check className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* ── Tab: Etiquetas ──────────────────────────────────────────────────── */}
      {tab === 'etiquetas' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 mb-1">Etiquetas de conversación</h3>
            <p className="text-xs text-zinc-500">
              Organiza las conversaciones con colores. Cada conversación puede tener múltiples etiquetas.
            </p>
          </div>

          {/* Crear etiqueta */}
          <div className="p-4 border border-zinc-200 rounded-2xl bg-white space-y-3">
            <h4 className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">Nueva etiqueta</h4>
            <div className="flex gap-3 items-center flex-wrap">
              <input
                type="text"
                value={nuevaEt.nombre}
                onChange={e => setNuevaEt(p => ({ ...p, nombre: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && crearEtiqueta()}
                placeholder="Nombre de la etiqueta"
                className="flex-1 min-w-40 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <div className="flex gap-1.5 flex-wrap">
                {COLORES_PRESET.map(c => (
                  <button
                    key={c}
                    onClick={() => setNuevaEt(p => ({ ...p, color: c }))}
                    className={cn(
                      'w-6 h-6 rounded-full transition border-2',
                      nuevaEt.color === c ? 'border-zinc-900 scale-110' : 'border-transparent hover:border-zinc-400'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                onClick={crearEtiqueta}
                disabled={!nuevaEt.nombre.trim() || creandoEt}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
                Crear
              </button>
            </div>
            {nuevaEt.nombre && (
              <div>
                <span className="text-xs text-zinc-500 mr-2">Vista previa:</span>
                <span className="text-xs px-2 py-1 rounded-full text-white font-medium" style={{ backgroundColor: nuevaEt.color }}>
                  {nuevaEt.nombre}
                </span>
              </div>
            )}
          </div>

          {/* Lista etiquetas */}
          <div className="space-y-2">
            {etiquetas.length === 0 && (
              <p className="text-sm text-zinc-400 text-center py-8">Sin etiquetas creadas</p>
            )}
            {etiquetas.map(e => (
              <div key={e.id} className="flex items-center gap-3 p-3 border border-zinc-100 rounded-xl hover:border-zinc-200 transition">
                <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                <span className="text-sm font-medium text-zinc-900 flex-1">{e.nombre}</span>
                <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: e.color }}>
                  {e.nombre}
                </span>
                <button
                  onClick={() => eliminarEtiqueta(e.id)}
                  className="p-1 text-zinc-300 hover:text-red-500 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Respuestas rápidas ────────────────────────────────────────── */}
      {tab === 'rapidas' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 mb-1">Respuestas rápidas</h3>
            <p className="text-xs text-zinc-500">
              En el chat, escribe <strong>/atajo</strong> para insertar una respuesta preescrita. Ahorra tiempo con preguntas frecuentes.
            </p>
          </div>

          {/* Crear respuesta */}
          <div className="p-4 border border-zinc-200 rounded-2xl bg-white space-y-3">
            <h4 className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">Nueva respuesta rápida</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Atajo (sin /)</label>
                <input
                  type="text"
                  value={nuevaRR.atajo}
                  onChange={e => setNuevaRR(p => ({ ...p, atajo: e.target.value.replace(/\//g, '') }))}
                  placeholder="ej: hola, precio, envio"
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Categoría (opcional)</label>
                <input
                  type="text"
                  value={nuevaRR.categoria}
                  onChange={e => setNuevaRR(p => ({ ...p, categoria: e.target.value }))}
                  placeholder="ej: saludo, preguntas, precios"
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Contenido del mensaje</label>
              <textarea
                value={nuevaRR.contenido}
                onChange={e => setNuevaRR(p => ({ ...p, contenido: e.target.value }))}
                placeholder="Hola! Gracias por contactarnos. ¿En qué te puedo ayudar?"
                rows={3}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
              />
            </div>
            <button
              onClick={crearRespuesta}
              disabled={!nuevaRR.atajo.trim() || !nuevaRR.contenido.trim() || creandoRR}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
              Crear respuesta
            </button>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {respuestas.length === 0 && (
              <p className="text-sm text-zinc-400 text-center py-8">Sin respuestas rápidas</p>
            )}
            {respuestas.map(r => (
              <div key={r.id} className="p-3 border border-zinc-100 rounded-xl hover:border-zinc-200 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-mono">
                        /{r.atajo}
                      </span>
                      {r.categoria && (
                        <span className="text-[11px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                          {r.categoria}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-600 mt-1 line-clamp-2">{r.contenido}</p>
                  </div>
                  <button
                    onClick={() => eliminarRespuesta(r.id)}
                    className="p-1 text-zinc-300 hover:text-red-500 transition shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
