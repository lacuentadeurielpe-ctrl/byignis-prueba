'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, Sparkles, FileText, Key, GraduationCap,
  Wrench, Repeat, Star, ChevronDown, ChevronUp, X, Loader2,
  Package2, MessageCircle, Zap, Globe, Users, Calendar,
} from 'lucide-react'
import { cn, formatPEN } from '@/lib/utils'
import type { ProductoDigital, TipoProductoDigital, MetodoEntregaDigital, PreguntaFrecuente } from '@/types/database'

// ── Configuración visual por tipo ──────────────────────────────────────────────

const TIPO_CONFIG: Record<TipoProductoDigital, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  archivo:     { label: 'Archivo',      icon: FileText,      color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  licencia:    { label: 'Licencia',     icon: Key,           color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  curso:       { label: 'Curso',        icon: GraduationCap, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  servicio:    { label: 'Servicio',     icon: Wrench,        color: 'text-emerald-600',bg: 'bg-emerald-50',border: 'border-emerald-200' },
  suscripcion: { label: 'Suscripción',  icon: Repeat,        color: 'text-pink-600',   bg: 'bg-pink-50',   border: 'border-pink-200' },
}

const METODO_CONFIG: Record<MetodoEntregaDigital, { label: string; icon: React.ElementType; color: string }> = {
  whatsapp_auto: { label: 'WhatsApp automático', icon: Zap,            color: 'text-emerald-600' },
  enlace_publico:{ label: 'Enlace público',       icon: Globe,          color: 'text-blue-600' },
  manual:        { label: 'Manual (dueño envía)', icon: MessageCircle,  color: 'text-zinc-500' },
}

const CAMPOS_OPCIONES = [
  { value: 'email',           label: 'Email' },
  { value: 'ruc',             label: 'RUC empresa' },
  { value: 'nombre_empresa',  label: 'Nombre empresa' },
  { value: 'fecha_preferida', label: 'Fecha preferida' },
  { value: 'dni',             label: 'DNI' },
  { value: 'direccion',       label: 'Dirección' },
]

const TIPOS: TipoProductoDigital[] = ['archivo', 'licencia', 'curso', 'servicio', 'suscripcion']
const METODOS: MetodoEntregaDigital[] = ['whatsapp_auto', 'enlace_publico', 'manual']

// ── Formulario vacío ──────────────────────────────────────────────────────────

function emptyForm() {
  return {
    nombre: '',
    tipo: 'servicio' as TipoProductoDigital,
    descripcion: '',
    precio: '',
    unidad: 'unidad',
    descripcion_bot: '',
    campos_requeridos: [] as string[],
    preguntas_frecuentes: [] as PreguntaFrecuente[],
    destacado: false,
    metodo_entrega: 'manual' as MetodoEntregaDigital,
    contenido_entrega: '',
    mensaje_post_venta: '',
    vigencia: '',
    cupos_totales: '',
    fecha_inicio: '',
    fecha_fin: '',
    activo: true,
  }
}

type FormData = ReturnType<typeof emptyForm>

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({
  open,
  onClose,
  producto,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  producto: ProductoDigital | null
  onSaved: (p: ProductoDigital) => void
}) {
  const [form, setForm] = useState<FormData>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [seccionAbierta, setSeccionAbierta] = useState<'basico' | 'bot' | 'entrega'>('basico')
  const [nuevaFaq, setNuevaFaq] = useState({ pregunta: '', respuesta: '' })

  useEffect(() => {
    if (!open) return
    if (producto) {
      setForm({
        nombre: producto.nombre,
        tipo: producto.tipo,
        descripcion: producto.descripcion || '',
        precio: String(producto.precio),
        unidad: producto.unidad,
        descripcion_bot: producto.descripcion_bot || '',
        campos_requeridos: producto.campos_requeridos || [],
        preguntas_frecuentes: producto.preguntas_frecuentes || [],
        destacado: producto.destacado,
        metodo_entrega: producto.metodo_entrega,
        contenido_entrega: producto.contenido_entrega || '',
        mensaje_post_venta: producto.mensaje_post_venta || '',
        vigencia: producto.vigencia || '',
        cupos_totales: producto.cupos_totales != null ? String(producto.cupos_totales) : '',
        fecha_inicio: producto.fecha_inicio || '',
        fecha_fin: producto.fecha_fin || '',
        activo: producto.activo,
      })
    } else {
      setForm(emptyForm())
    }
    setError('')
    setSeccionAbierta('basico')
  }, [open, producto])

  const set = (field: keyof FormData, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const toggleCampo = (val: string) => {
    const arr = form.campos_requeridos
    set('campos_requeridos', arr.includes(val) ? arr.filter(c => c !== val) : [...arr, val])
  }

  const addFaq = () => {
    if (!nuevaFaq.pregunta.trim() || !nuevaFaq.respuesta.trim()) return
    set('preguntas_frecuentes', [...form.preguntas_frecuentes, { ...nuevaFaq }])
    setNuevaFaq({ pregunta: '', respuesta: '' })
  }

  const removeFaq = (idx: number) =>
    set('preguntas_frecuentes', form.preguntas_frecuentes.filter((_, i) => i !== idx))

  const handleSubmit = async () => {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    if (!form.precio || isNaN(Number(form.precio)) || Number(form.precio) < 0) {
      setError('El precio es inválido'); return
    }
    setSaving(true)
    setError('')
    try {
      const url = producto ? `/api/catalog/digital/${producto.id}` : '/api/catalog/digital'
      const method = producto ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          precio: Number(form.precio),
          cupos_totales: form.cupos_totales ? Number(form.cupos_totales) : null,
          fecha_inicio: form.fecha_inicio || null,
          fecha_fin: form.fecha_fin || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Error al guardar')
        return
      }
      const saved = await res.json()
      onSaved(saved)
      onClose()
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const SeccionHeader = ({
    id, title, desc,
  }: { id: typeof seccionAbierta; title: string; desc: string }) => (
    <button
      type="button"
      onClick={() => setSeccionAbierta(seccionAbierta === id ? 'basico' : id)}
      className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 rounded-lg border border-zinc-200 hover:bg-zinc-100 transition"
    >
      <div className="text-left">
        <p className="text-sm font-semibold text-zinc-800">{title}</p>
        <p className="text-xs text-zinc-500">{desc}</p>
      </div>
      {seccionAbierta === id
        ? <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />
        : <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />}
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <h2 className="text-base font-bold text-zinc-900">
              {producto ? 'Editar producto digital' : 'Nuevo producto digital'}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Todo lo que guardes aquí lo usará el bot para venderlo por WhatsApp
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 transition">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          {/* SECCIÓN 1: Básico */}
          <SeccionHeader id="basico" title="1 · Información básica" desc="Nombre, tipo, precio y descripción" />
          {seccionAbierta === 'basico' && (
            <div className="space-y-3 pt-1">
              {/* Tipo */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-2">Tipo de producto</label>
                <div className="flex flex-wrap gap-2">
                  {TIPOS.map(t => {
                    const cfg = TIPO_CONFIG[t]
                    const Icon = cfg.icon
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => set('tipo', t)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition',
                          form.tipo === t
                            ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                            : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Nombre <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => set('nombre', e.target.value)}
                  placeholder="Ej: Curso de Instalaciones Eléctricas"
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              {/* Precio + Unidad */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Precio S/ <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.precio}
                    onChange={e => set('precio', e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
                <div className="w-36">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Unidad</label>
                  <input
                    type="text"
                    value={form.unidad}
                    onChange={e => set('unidad', e.target.value)}
                    placeholder="licencia, hora, cupo…"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>

              {/* Descripción interna */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Descripción interna</label>
                <textarea
                  value={form.descripcion}
                  onChange={e => set('descripcion', e.target.value)}
                  rows={2}
                  placeholder="Notas privadas sobre este producto (el bot no las ve)"
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
                />
              </div>

              {/* Vigencia + Cupos */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Vigencia</label>
                  <input
                    type="text"
                    value={form.vigencia}
                    onChange={e => set('vigencia', e.target.value)}
                    placeholder="1 año, mensual, de por vida…"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
                <div className="w-36">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Cupos totales</label>
                  <input
                    type="number"
                    min="1"
                    value={form.cupos_totales}
                    onChange={e => set('cupos_totales', e.target.value)}
                    placeholder="Vacío = ∞"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>

              {/* Fechas (solo cursos) */}
              {form.tipo === 'curso' && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Fecha inicio</label>
                    <input
                      type="date"
                      value={form.fecha_inicio}
                      onChange={e => set('fecha_inicio', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Fecha fin / límite inscripción</label>
                    <input
                      type="date"
                      value={form.fecha_fin}
                      onChange={e => set('fecha_fin', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                </div>
              )}

              {/* Activo + Destacado */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={e => set('activo', e.target.checked)}
                    className="w-4 h-4 rounded accent-zinc-900"
                  />
                  <span className="text-sm text-zinc-700">Producto activo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.destacado}
                    onChange={e => set('destacado', e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <span className="text-sm text-zinc-700">Destacado <span className="text-zinc-400">(bot lo menciona primero)</span></span>
                </label>
              </div>
            </div>
          )}

          {/* SECCIÓN 2: Para el bot */}
          <SeccionHeader id="bot" title="2 · Para el bot de WhatsApp" desc="Cómo el bot describe y vende este producto" />
          {seccionAbierta === 'bot' && (
            <div className="space-y-3 pt-1">
              {/* Descripción del bot */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Descripción de venta
                  <span className="ml-1 text-zinc-400 font-normal">(el bot la usa para explicar el producto al cliente)</span>
                </label>
                <textarea
                  value={form.descripcion_bot}
                  onChange={e => set('descripcion_bot', e.target.value)}
                  rows={3}
                  placeholder="Ej: Aprende a instalar tableros eléctricos desde cero. 8 horas con instructor certificado. Material incluido. Certificado digital al finalizar."
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
                />
              </div>

              {/* Campos requeridos */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-2">
                  Datos que el bot debe pedir al cliente antes de confirmar la venta
                </label>
                <div className="flex flex-wrap gap-2">
                  {CAMPOS_OPCIONES.map(op => {
                    const selected = form.campos_requeridos.includes(op.value)
                    return (
                      <button
                        key={op.value}
                        type="button"
                        onClick={() => toggleCampo(op.value)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium border transition',
                          selected
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                        )}
                      >
                        {selected && '✓ '}{op.label}
                      </button>
                    )
                  })}
                </div>
                {form.campos_requeridos.length === 0 && (
                  <p className="text-xs text-zinc-400 mt-1.5">Sin datos requeridos — el bot solo pedirá nombre y teléfono (los de siempre)</p>
                )}
              </div>

              {/* FAQ */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-2">
                  Preguntas frecuentes
                  <span className="ml-1 text-zinc-400 font-normal">(el bot responde exactamente esto cuando el cliente pregunta)</span>
                </label>

                {form.preguntas_frecuentes.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {form.preguntas_frecuentes.map((faq, idx) => (
                      <div key={idx} className="flex gap-2 p-2.5 bg-zinc-50 rounded-lg border border-zinc-200">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-zinc-700 truncate">❓ {faq.pregunta}</p>
                          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">💬 {faq.respuesta}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFaq(idx)}
                          className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2 p-3 border border-dashed border-zinc-300 rounded-lg bg-zinc-50">
                  <input
                    type="text"
                    value={nuevaFaq.pregunta}
                    onChange={e => setNuevaFaq(p => ({ ...p, pregunta: e.target.value }))}
                    placeholder="Pregunta del cliente: ¿Incluye certificado?"
                    className="w-full px-3 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
                  />
                  <input
                    type="text"
                    value={nuevaFaq.respuesta}
                    onChange={e => setNuevaFaq(p => ({ ...p, respuesta: e.target.value }))}
                    placeholder="Respuesta exacta: Sí, certificado digital al finalizar."
                    className="w-full px-3 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
                  />
                  <button
                    type="button"
                    onClick={addFaq}
                    disabled={!nuevaFaq.pregunta.trim() || !nuevaFaq.respuesta.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-100 disabled:opacity-40 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar pregunta
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECCIÓN 3: Entrega */}
          <SeccionHeader id="entrega" title="3 · Cómo se entrega" desc="Qué pasa después de que el cliente paga" />
          {seccionAbierta === 'entrega' && (
            <div className="space-y-3 pt-1">
              {/* Método */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-2">Método de entrega</label>
                <div className="space-y-2">
                  {METODOS.map(m => {
                    const cfg = METODO_CONFIG[m]
                    const Icon = cfg.icon
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => set('metodo_entrega', m)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition',
                          form.metodo_entrega === m
                            ? 'border-zinc-900 bg-zinc-50'
                            : 'border-zinc-200 bg-white hover:border-zinc-300'
                        )}
                      >
                        <Icon className={cn('w-4 h-4 shrink-0', cfg.color)} />
                        <div>
                          <p className="text-xs font-semibold text-zinc-800">{cfg.label}</p>
                          <p className="text-xs text-zinc-400">
                            {m === 'whatsapp_auto' && 'El bot envía el acceso automáticamente cuando el pago está confirmado'}
                            {m === 'enlace_publico' && 'El cliente recibe un link que puede compartir (sin restricción de persona)'}
                            {m === 'manual' && 'El dueño recibe notificación y envía el acceso manualmente'}
                          </p>
                        </div>
                        {form.metodo_entrega === m && (
                          <span className="ml-auto text-xs font-bold text-zinc-900">✓</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Contenido de entrega */}
              {form.metodo_entrega !== 'manual' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    {form.metodo_entrega === 'whatsapp_auto' ? 'Link o código de acceso' : 'URL del enlace público'}
                  </label>
                  <input
                    type="text"
                    value={form.contenido_entrega}
                    onChange={e => set('contenido_entrega', e.target.value)}
                    placeholder={form.metodo_entrega === 'whatsapp_auto'
                      ? 'https://drive.google.com/... o código: ABC-123'
                      : 'https://...'}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              )}

              {/* Mensaje post-venta */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Mensaje WhatsApp post-pago
                  <span className="ml-1 text-zinc-400 font-normal">(puedes usar {'{{nombre}}'} y {'{{email}}'})</span>
                </label>
                <textarea
                  value={form.mensaje_post_venta}
                  onChange={e => set('mensaje_post_venta', e.target.value)}
                  rows={3}
                  placeholder={`Hola {{nombre}}, aquí tienes tu acceso:\n\n🔗 Link: ${form.contenido_entrega || 'https://...'}\n\n¡Gracias por tu compra! 🎉`}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none font-mono"
                />
                <p className="text-xs text-zinc-400 mt-1">
                  {form.metodo_entrega === 'whatsapp_auto'
                    ? 'El bot enviará este mensaje automáticamente al confirmar el pago'
                    : 'Úsalo como plantilla cuando envíes el acceso manualmente'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl disabled:opacity-50 transition"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {producto ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card de producto digital ───────────────────────────────────────────────────

function ProductoCard({
  producto,
  onEdit,
  onDelete,
  onToggleActivo,
}: {
  producto: ProductoDigital
  onEdit: () => void
  onDelete: () => void
  onToggleActivo: () => void
}) {
  const tipo = TIPO_CONFIG[producto.tipo]
  const metodo = METODO_CONFIG[producto.metodo_entrega]
  const Icon = tipo.icon
  const MetodoIcon = metodo.icon
  const cuposLibres = producto.cupos_totales != null ? producto.cupos_totales - producto.cupos_usados : null

  return (
    <div className={cn(
      'bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow flex flex-col',
      !producto.activo && 'opacity-60'
    )}>
      {/* Top */}
      <div className="p-4 flex items-start gap-3">
        <div className={cn('p-2 rounded-xl shrink-0', tipo.bg)}>
          <Icon className={cn('w-5 h-5', tipo.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border',
              tipo.bg, tipo.border, tipo.color
            )}>
              {tipo.label}
            </span>
            {producto.destacado && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 border border-amber-200 text-amber-600">
                <Star className="w-2.5 h-2.5" /> Destacado
              </span>
            )}
            {!producto.activo && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 text-zinc-400">
                Inactivo
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-zinc-900 mt-1.5 leading-tight">{producto.nombre}</h3>
          {producto.descripcion_bot && (
            <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{producto.descripcion_bot}</p>
          )}
        </div>
      </div>

      {/* Mid */}
      <div className="px-4 pb-3 space-y-2">
        {/* Precio */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-black text-zinc-900">{formatPEN(producto.precio)}</span>
          <span className="text-xs text-zinc-400">/ {producto.unidad}</span>
        </div>

        {/* Chips de info */}
        <div className="flex flex-wrap gap-1.5">
          {producto.vigencia && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-600">
              <Repeat className="w-2.5 h-2.5" />
              {producto.vigencia}
            </span>
          )}
          {cuposLibres != null && (
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
              cuposLibres <= 3
                ? 'bg-red-50 text-red-600'
                : 'bg-emerald-50 text-emerald-600'
            )}>
              <Users className="w-2.5 h-2.5" />
              {cuposLibres} cupos libres
            </span>
          )}
          {producto.fecha_inicio && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">
              <Calendar className="w-2.5 h-2.5" />
              {new Date(producto.fecha_inicio + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>

        {/* Campos requeridos */}
        {producto.campos_requeridos.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] text-zinc-400">Bot pide:</span>
            {producto.campos_requeridos.map(c => (
              <span key={c} className="text-[10px] px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-600">
                {CAMPOS_OPCIONES.find(o => o.value === c)?.label ?? c}
              </span>
            ))}
          </div>
        )}

        {/* Entrega */}
        <div className="flex items-center gap-1.5">
          <MetodoIcon className={cn('w-3 h-3', metodo.color)} />
          <span className="text-[10px] text-zinc-400">{metodo.label}</span>
          {producto.preguntas_frecuentes.length > 0 && (
            <span className="ml-auto text-[10px] text-zinc-400">
              {producto.preguntas_frecuentes.length} FAQ
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto px-4 py-3 border-t border-zinc-100 flex items-center gap-2">
        <button
          onClick={onToggleActivo}
          className={cn(
            'flex-1 py-1.5 rounded-lg text-xs font-medium transition',
            producto.activo
              ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          )}
        >
          {producto.activo ? 'Desactivar' : 'Activar'}
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700 transition"
          title="Editar"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition"
          title="Eliminar"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="text-center py-20">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-50 border-2 border-dashed border-violet-200 mb-4">
        <Sparkles className="w-7 h-7 text-violet-400" />
      </div>
      <h3 className="text-base font-bold text-zinc-800 mb-1">Aún no tienes productos digitales</h3>
      <p className="text-sm text-zinc-400 max-w-xs mx-auto mb-6">
        Agrega cursos, servicios, licencias o archivos y el bot los venderá por WhatsApp automáticamente.
      </p>
      <button
        onClick={onNew}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition"
      >
        <Plus className="w-4 h-4" />
        Crear primer producto digital
      </button>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function DigitalProductsClient({ initial }: { initial: ProductoDigital[] }) {
  const [productos, setProductos] = useState<ProductoDigital[]>(initial)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<ProductoDigital | null>(null)
  const [eliminando, setEliminando] = useState<ProductoDigital | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoProductoDigital | 'todos'>('todos')

  const productosFiltrados = productos.filter(p => {
    const coincideBusqueda =
      !busqueda ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.descripcion_bot || '').toLowerCase().includes(busqueda.toLowerCase())
    const coincideTipo = filtroTipo === 'todos' || p.tipo === filtroTipo
    return coincideBusqueda && coincideTipo
  })

  const openNew = () => { setEditando(null); setModalOpen(true) }
  const openEdit = (p: ProductoDigital) => { setEditando(p); setModalOpen(true) }

  const handleSaved = useCallback((saved: ProductoDigital) => {
    setProductos(prev => {
      const idx = prev.findIndex(p => p.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [saved, ...prev]
    })
  }, [])

  const handleToggleActivo = async (p: ProductoDigital) => {
    const res = await fetch(`/api/catalog/digital/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !p.activo }),
    })
    if (res.ok) {
      const updated = await res.json()
      handleSaved(updated)
    }
  }

  const handleDelete = async () => {
    if (!eliminando) return
    const res = await fetch(`/api/catalog/digital/${eliminando.id}`, { method: 'DELETE' })
    if (res.ok) {
      setProductos(prev => prev.filter(p => p.id !== eliminando.id))
      setEliminando(null)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            Productos digitales
          </h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            {productos.length} producto{productos.length !== 1 ? 's' : ''} · el bot los vende por WhatsApp
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo producto
        </button>
      </div>

      {/* Filtros */}
      {productos.length > 0 && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 w-52"
          />
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setFiltroTipo('todos')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg border transition',
                filtroTipo === 'todos'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400'
              )}
            >
              Todos
            </button>
            {TIPOS.map(t => {
              const cfg = TIPO_CONFIG[t]
              const Icon = cfg.icon
              return (
                <button
                  key={t}
                  onClick={() => setFiltroTipo(t)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition',
                    filtroTipo === t
                      ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                      : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Grid */}
      {productos.length === 0 ? (
        <EmptyState onNew={openNew} />
      ) : productosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-sm text-zinc-400">
          Sin resultados para &quot;{busqueda}&quot;
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {productosFiltrados.map(p => (
            <ProductoCard
              key={p.id}
              producto={p}
              onEdit={() => openEdit(p)}
              onDelete={() => setEliminando(p)}
              onToggleActivo={() => handleToggleActivo(p)}
            />
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        producto={editando}
        onSaved={handleSaved}
      />

      {/* Confirm eliminar */}
      {eliminando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEliminando(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-red-50 mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 text-center mb-1">¿Eliminar producto?</h3>
            <p className="text-sm text-zinc-500 text-center mb-6">
              <strong>{eliminando.nombre}</strong> será eliminado permanentemente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setEliminando(null)}
                className="flex-1 py-2.5 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
