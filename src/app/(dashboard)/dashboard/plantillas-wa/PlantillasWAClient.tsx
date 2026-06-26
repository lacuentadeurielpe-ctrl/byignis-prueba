'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Plus, Edit3, Trash2, CheckCircle2, XCircle, Clock,
  AlertCircle, Send, FileText, Eye, EyeOff, RefreshCw, Upload, Zap,
} from 'lucide-react'

interface PlantillaBoton {
  tipo: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
  texto: string
  valor?: string
}

interface Plantilla {
  id: string
  nombre: string
  categoria: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  idioma: string
  header_tipo: string | null
  header_contenido: string | null
  cuerpo: string
  footer: string | null
  botones: PlantillaBoton[]
  variables: string[]
  meta_status: 'borrador' | 'pendiente' | 'aprobada' | 'rechazada'
  meta_rechazo_motivo: string | null
  ycloud_template_name: string | null
  created_at: string
}

const STATUS_BADGE: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  borrador:  { label: 'Borrador',  className: 'bg-zinc-100 text-zinc-600',       icon: <Edit3 className="w-3 h-3" /> },
  pendiente: { label: 'Pendiente', className: 'bg-blue-100 text-blue-700',       icon: <Clock className="w-3 h-3" /> },
  aprobada:  { label: 'Aprobada',  className: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="w-3 h-3" /> },
  rechazada: { label: 'Rechazada', className: 'bg-red-100 text-red-700',         icon: <XCircle className="w-3 h-3" /> },
}

const CATEGORIA_COLOR: Record<string, string> = {
  MARKETING:      'bg-purple-50 text-purple-700',
  UTILITY:        'bg-blue-50 text-blue-700',
  AUTHENTICATION: 'bg-amber-50 text-amber-700',
}

interface Props {
  plantillasIniciales: Plantilla[]
  tieneMetaActivo: boolean
}

const EMPTY_FORM = {
  nombre: '',
  categoria: 'MARKETING' as const,
  idioma: 'es',
  header_tipo: '' as string,
  header_contenido: '',
  cuerpo: '',
  footer: '',
  ycloud_template_name: '',
}

export default function PlantillasWAClient({ plantillasIniciales, tieneMetaActivo }: Props) {
  const [plantillas,  setPlantillas]  = useState<Plantilla[]>(plantillasIniciales)
  const [showNueva,   setShowNueva]   = useState(false)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [preview,     setPreview]     = useState<string | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [guardando,   setGuardando]   = useState(false)
  const [publicando,  setPublicando]  = useState<string | null>(null)
  const [eliminandoMeta, setEliminandoMeta] = useState<string | null>(null)
  const [sincronizando, setSincronizando]   = useState(false)
  const [syncMsg, setSyncMsg]               = useState<string | null>(null)

  function variable(texto: string) {
    return (texto.match(/\{\{(\d+)\}\}/g) ?? [])
  }

  async function guardarPlantilla() {
    if (!form.nombre.trim() || !form.cuerpo.trim()) {
      setError('Nombre y cuerpo son requeridos')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch('/api/plantillas-wa', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          nombre:              form.nombre.trim(),
          categoria:           form.categoria,
          idioma:              form.idioma,
          header_tipo:         form.header_tipo || null,
          header_contenido:    form.header_contenido.trim() || null,
          cuerpo:              form.cuerpo.trim(),
          footer:              form.footer.trim() || null,
          botones:             [],
          variables:           variable(form.cuerpo),
          ycloud_template_name: form.ycloud_template_name.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Error al guardar')
        return
      }
      const nueva = await res.json()
      setPlantillas(prev => [nueva, ...prev])
      setShowNueva(false)
      setForm(EMPTY_FORM)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta plantilla?')) return
    const res = await fetch(`/api/plantillas-wa/${id}`, { method: 'DELETE' })
    if (res.ok) setPlantillas(prev => prev.filter(p => p.id !== id))
  }

  async function publicarEnMeta(id: string) {
    setPublicando(id)
    setError(null)
    try {
      const res = await fetch(`/api/plantillas-wa/${id}/publicar-meta`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al publicar en Meta')
        return
      }
      setPlantillas(prev => prev.map(p => p.id === id ? { ...p, meta_status: 'pendiente' } : p))
    } finally {
      setPublicando(null)
    }
  }

  async function eliminarDeMeta(id: string, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}" de Meta? Meta eliminará todas las versiones de esta plantilla.`)) return
    setEliminandoMeta(id)
    setError(null)
    try {
      const res = await fetch(`/api/plantillas-wa/${id}/meta`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al eliminar de Meta')
        return
      }
      setPlantillas(prev => prev.map(p => p.id === id ? { ...p, meta_status: 'borrador', meta_rechazo_motivo: null } : p))
    } finally {
      setEliminandoMeta(null)
    }
  }

  async function sincronizarDesdeMeta() {
    setSincronizando(true)
    setSyncMsg(null)
    setError(null)
    try {
      const res = await fetch('/api/plantillas-wa/sync-meta')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al sincronizar')
        return
      }
      setSyncMsg(`Sincronizado: ${data.actualizadas} plantilla${data.actualizadas !== 1 ? 's' : ''} actualizada${data.actualizadas !== 1 ? 's' : ''} de ${data.total} en Meta`)
      // Recargar lista completa
      const listRes = await fetch('/api/plantillas-wa')
      if (listRes.ok) setPlantillas(await listRes.json())
    } finally {
      setSincronizando(false)
    }
  }

  function renderPreview(p: Plantilla) {
    const vars = ['Nombre', 'Producto', 'Monto', 'Fecha']
    let texto = p.cuerpo
    let i = 0
    texto = texto.replace(/\{\{\d+\}\}/g, () => `[${vars[i++] ?? 'var'}]`)
    return texto
  }

  return (
    <div className="p-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-950">Plantillas WhatsApp</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Crea y gestiona tus plantillas HSM para campañas fuera de la ventana de 24h
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tieneMetaActivo && (
            <button
              onClick={sincronizarDesdeMeta}
              disabled={sincronizando}
              className="flex items-center gap-2 border border-zinc-200 text-zinc-700 px-3 py-2 rounded-xl text-sm font-medium hover:bg-zinc-50 transition disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', sincronizando && 'animate-spin')} />
              Sincronizar Meta
            </button>
          )}
          <button
            onClick={() => setShowNueva(true)}
            className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-zinc-800 transition"
          >
            <Plus className="w-4 h-4" />
            Nueva plantilla
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {syncMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {syncMsg}
          <button onClick={() => setSyncMsg(null)} className="ml-auto"><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {/* Info */}
      {tieneMetaActivo ? (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex items-start gap-3">
          <Zap className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold mb-0.5">Meta Cloud API conectada</p>
            <p>Puedes enviar plantillas directamente a Meta para aprobación desde esta pantalla. Una vez aprobadas, úsalas en campañas masivas.</p>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <p className="font-semibold mb-1">¿Cómo funciona?</p>
          <p>Crea la plantilla aquí, luego configura tu cuenta Meta en <strong>Ajustes → Integraciones → Meta</strong> para enviarla a aprobación. Con YCloud, usa el nombre exacto de la plantilla de tu cuenta YCloud.</p>
        </div>
      )}

      {/* Formulario */}
      {showNueva && (
        <div className="mb-6 p-5 border border-zinc-200 rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-zinc-900">Nueva plantilla</h2>
            <button onClick={() => setShowNueva(false)} className="text-zinc-400 hover:text-zinc-700">
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-700 block mb-1">Nombre * (sin espacios)</label>
              <input
                type="text"
                value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value.replace(/\s+/g, '_').toLowerCase() }))}
                placeholder="ej: promo_julio_2025"
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <p className="text-[11px] text-zinc-400 mt-0.5">Usa solo letras, números y guiones bajos</p>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 block mb-1">Categoría</label>
              <select
                value={form.categoria}
                onChange={e => setForm(p => ({ ...p, categoria: e.target.value as typeof form.categoria }))}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="MARKETING">Marketing</option>
                <option value="UTILITY">Utilidad</option>
                <option value="AUTHENTICATION">Autenticación</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 block mb-1">Nombre plantilla YCloud</label>
              <input
                type="text"
                value={form.ycloud_template_name}
                onChange={e => setForm(p => ({ ...p, ycloud_template_name: e.target.value }))}
                placeholder="Si usas YCloud, escríbelo aquí"
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 block mb-1">Encabezado (opcional)</label>
              <div className="flex gap-2">
                <select
                  value={form.header_tipo}
                  onChange={e => setForm(p => ({ ...p, header_tipo: e.target.value }))}
                  className="border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  <option value="">Sin encabezado</option>
                  <option value="TEXT">Texto</option>
                  <option value="IMAGE">Imagen</option>
                  <option value="DOCUMENT">Documento</option>
                </select>
                {form.header_tipo && (
                  <input
                    type="text"
                    value={form.header_contenido}
                    onChange={e => setForm(p => ({ ...p, header_contenido: e.target.value }))}
                    placeholder={form.header_tipo === 'TEXT' ? 'Texto del encabezado' : 'URL del archivo'}
                    className="flex-1 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium text-zinc-700 block mb-1">
                Cuerpo del mensaje * — usa {'{{'}<span>1</span>{'}}'}  para variables
              </label>
              <textarea
                value={form.cuerpo}
                onChange={e => setForm(p => ({ ...p, cuerpo: e.target.value }))}
                placeholder={`Hola {{1}}, te recordamos tu pedido de {{2}}. Puedes recogerlo hoy.`}
                rows={4}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
              />
              {variable(form.cuerpo).length > 0 && (
                <p className="text-[11px] text-blue-600 mt-0.5">
                  Variables detectadas: {variable(form.cuerpo).join(', ')}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium text-zinc-700 block mb-1">Pie de página (opcional)</label>
              <input
                type="text"
                value={form.footer}
                onChange={e => setForm(p => ({ ...p, footer: e.target.value }))}
                placeholder="Ej: Responde STOP para dejar de recibir mensajes"
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowNueva(false)}
              className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              onClick={guardarPlantilla}
              disabled={guardando}
              className="px-4 py-2 text-sm bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition font-medium disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Guardar plantilla'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {plantillas.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <FileText className="w-10 h-10 mx-auto mb-3 text-zinc-200" />
          <p className="text-sm font-medium">Sin plantillas aún</p>
          <p className="text-xs mt-1">Crea tu primera plantilla para usar en campañas masivas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plantillas.map((p) => {
            const badge      = STATUS_BADGE[p.meta_status] ?? STATUS_BADGE.borrador
            const isPreview  = preview === p.id
            const catClass   = CATEGORIA_COLOR[p.categoria] ?? ''
            const isPub      = publicando === p.id
            const isDelMeta  = eliminandoMeta === p.id

            return (
              <div key={p.id} className="p-4 bg-white border border-zinc-200 rounded-2xl hover:border-zinc-300 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-zinc-900 font-mono text-sm">{p.nombre}</p>
                      <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1', badge.className)}>
                        {badge.icon} {badge.label}
                      </span>
                      <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', catClass)}>
                        {p.categoria}
                      </span>
                    </div>
                    {p.meta_rechazo_motivo && (
                      <p className="text-xs text-red-600 mt-1">Motivo rechazo: {p.meta_rechazo_motivo}</p>
                    )}
                    {p.ycloud_template_name && (
                      <p className="text-xs text-zinc-400 mt-0.5">YCloud: {p.ycloud_template_name}</p>
                    )}
                    {isPreview && (
                      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed max-w-sm">
                        {p.header_contenido && (
                          <p className="font-semibold mb-2 text-zinc-600 text-xs uppercase tracking-wide">
                            {p.header_tipo}: {p.header_contenido}
                          </p>
                        )}
                        {renderPreview(p)}
                        {p.footer && <p className="text-xs text-zinc-400 mt-2 border-t border-emerald-200 pt-2">{p.footer}</p>}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                    <button
                      onClick={() => setPreview(isPreview ? null : p.id)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition"
                      title="Vista previa"
                    >
                      {isPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                    {/* Publicar en Meta (si tiene Meta activo y está en borrador o rechazada) */}
                    {tieneMetaActivo && (p.meta_status === 'borrador' || p.meta_status === 'rechazada') && (
                      <button
                        onClick={() => publicarEnMeta(p.id)}
                        disabled={isPub}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
                        title="Enviar a Meta para aprobación"
                      >
                        {isPub ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        {isPub ? 'Enviando…' : 'Publicar en Meta'}
                      </button>
                    )}

                    {/* Eliminar de Meta (si fue enviada y Meta activo) */}
                    {tieneMetaActivo && (p.meta_status === 'pendiente' || p.meta_status === 'aprobada') && (
                      <button
                        onClick={() => eliminarDeMeta(p.id, p.nombre)}
                        disabled={isDelMeta}
                        className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition disabled:opacity-50"
                        title="Eliminar de Meta"
                      >
                        {isDelMeta ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 rotate-180" />}
                      </button>
                    )}

                    <button
                      onClick={() => eliminar(p.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
