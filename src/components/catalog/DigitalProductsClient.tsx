'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Plus, Pencil, Trash2, Sparkles, Download, Link2, Key,
  MessageCircle, Star, X, Loader2, RefreshCw, Upload,
  GraduationCap, Laptop, FileText, Wrench, Zap, Package2, Tag,
} from 'lucide-react'
import { cn, formatPEN } from '@/lib/utils'
import type { ProductoDigital } from '@/types/database'

// ── Constantes ────────────────────────────────────────────────────────────────

const CATEGORIAS = ['Cursos', 'Software', 'Documentos', 'Asesorías', 'Plantillas', 'Servicios', 'Otro']

const TIPOS_ENTREGA = [
  { value: 'descarga', label: 'Descarga de archivo',  desc: 'PDF, ZIP, EXE — el bot envía el link al confirmar el pago', Icon: Download },
  { value: 'link',     label: 'Link de acceso',        desc: 'Drive, plataforma, video — link enviado automáticamente',  Icon: Link2 },
  { value: 'clave',    label: 'Clave de activación',   desc: 'Código o serial enviado por WhatsApp al cliente',          Icon: Key },
  { value: 'manual',   label: 'Entrega manual',        desc: 'El dueño coordina y envía el acceso personalmente',        Icon: MessageCircle },
] as const

const CATEGORIA_ICONS: Record<string, React.ElementType> = {
  'Cursos':      GraduationCap,
  'Software':    Laptop,
  'Documentos':  FileText,
  'Asesorías':   Wrench,
  'Plantillas':  FileText,
  'Servicios':   Zap,
}

function getCatIcon(cat: string): React.ElementType {
  return CATEGORIA_ICONS[cat] ?? Package2
}

// ── Form ──────────────────────────────────────────────────────────────────────

function emptyForm() {
  return {
    nombre: '',
    categoria: 'General',
    subcategoria: '',
    descripcion: '',
    precio: '',
    precio_original: '',
    unidad: 'unidad',
    stock: '',
    vigencia: '',
    tags: [] as string[],
    destacado: false,
    activo: true,
    tipos_entrega: ['manual'] as string[],
    archivo_url: '',
    contenido_entrega: '',
    mensaje_entrega: '',
    pdf_contexto_url: '',
  }
}
type FormData = ReturnType<typeof emptyForm>

// ── TagInput ──────────────────────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('')

  const add = () => {
    const val = input.trim().toLowerCase()
    if (val && !tags.includes(val)) onChange([...tags, val])
    setInput('')
  }
  const remove = (tag: string) => onChange(tags.filter(t => t !== tag))

  return (
    <div className="flex flex-wrap gap-1.5 p-2 min-h-[40px] border border-zinc-200 rounded-lg focus-within:ring-2 focus-within:ring-zinc-900 bg-white">
      {tags.map(tag => (
        <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-900 text-white text-[11px] rounded-full">
          {tag}
          <button type="button" onClick={() => remove(tag)} className="hover:text-zinc-300 transition">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
          if (e.key === 'Backspace' && !input && tags.length) onChange(tags.slice(0, -1))
        }}
        onBlur={add}
        placeholder={tags.length === 0 ? 'Escribe una etiqueta y presiona Enter...' : ''}
        className="flex-1 min-w-[150px] text-xs outline-none bg-transparent"
      />
    </div>
  )
}

// ── FileUploader ──────────────────────────────────────────────────────────────

function FileUploader({
  value,
  onChange,
  accept = '.pdf,.zip,.exe,.mp4,.docx,.xlsx,.png,.jpg,.jpeg,.rar,.7z',
  hint = 'PDF · ZIP · EXE · MP4 · DOCX · hasta 50 MB',
}: {
  value: string
  onChange: (url: string) => void
  accept?: string
  hint?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  const handleFile = async (file: File) => {
    setUploading(true)
    setErr('')
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/catalog/digital/upload', { method: 'POST', body: fd })
      if (!res.ok) { const e = await res.json(); setErr(e.error ?? 'Error al subir'); return }
      const data = await res.json()
      onChange(data.url)
    } catch {
      setErr('Error de conexión')
    } finally {
      setUploading(false)
    }
  }

  if (value) {
    const filename = value.split('/').pop() ?? value
    return (
      <div className="flex items-center gap-2 p-2.5 border border-emerald-200 rounded-lg bg-emerald-50">
        <Download className="w-4 h-4 text-emerald-600 shrink-0" />
        <a href={value} target="_blank" rel="noopener noreferrer"
          className="text-xs text-emerald-700 flex-1 truncate hover:underline">{filename}</a>
        <button onClick={() => onChange('')} type="button"
          className="text-emerald-400 hover:text-red-500 transition shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]) }}
        className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-zinc-200 rounded-lg bg-zinc-50 hover:bg-zinc-100 cursor-pointer transition"
      >
        {uploading
          ? <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
          : <Upload className="w-6 h-6 text-zinc-400" />}
        <p className="text-xs text-zinc-500 text-center">
          {uploading ? 'Subiendo...' : <><span className="text-violet-600 font-medium">Haz clic</span> o arrastra el archivo aquí</>}
        </p>
        <p className="text-[10px] text-zinc-400">{hint}</p>
      </div>
      {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
      <input
        ref={inputRef} type="file"
        accept={accept}
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  )
}

// ── CtxBox ────────────────────────────────────────────────────────────────────

function CtxBox({ producto, onUpdated }: {
  producto: ProductoDigital
  onUpdated: (p: ProductoDigital) => void
}) {
  const [generating, setGenerating] = useState(false)

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/catalog/digital/${producto.id}/contextualizar`, { method: 'POST' })
      if (res.ok) onUpdated(await res.json())
    } finally {
      setGenerating(false)
    }
  }

  const hasPdf = Boolean(producto.pdf_contexto_url)

  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden text-xs">
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-zinc-50 border-b border-zinc-100">
        <span className="flex items-center gap-1.5 font-medium text-zinc-500">
          <Sparkles className="w-3 h-3 text-violet-500" />
          Contexto para el bot
          {hasPdf && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded text-[9px] font-medium">
              <FileText className="w-2.5 h-2.5" /> PDF
            </span>
          )}
        </span>
        {producto.contextualizacion && (
          <button onClick={generate} disabled={generating}
            className="flex items-center gap-1 px-2 py-0.5 border border-zinc-200 rounded text-[10px] text-zinc-500 hover:bg-white disabled:opacity-50 transition">
            {generating
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <RefreshCw className="w-3 h-3" />}
            Re-generar
          </button>
        )}
      </div>
      <div className="px-2.5 py-2">
        {producto.contextualizacion ? (
          <p className="text-zinc-500 italic leading-relaxed line-clamp-3">{producto.contextualizacion}</p>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-400">
              {hasPdf ? 'PDF listo — genera el contexto' : 'Sin contextualizar aún'}
            </span>
            <button onClick={generate} disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1 bg-violet-600 text-white rounded-lg text-[10px] font-semibold hover:bg-violet-700 disabled:opacity-50 transition whitespace-nowrap">
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {generating ? 'Generando...' : 'Generar contexto IA'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ open, onClose, producto, onSaved }: {
  open: boolean
  onClose: () => void
  producto: ProductoDigital | null
  onSaved: (p: ProductoDigital) => void
}) {
  const [form, setForm] = useState<FormData>(emptyForm())
  const [tab, setTab] = useState<'datos' | 'entrega'>('datos')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setTab('datos')
    setError('')
    if (producto) {
      setForm({
        nombre:          producto.nombre,
        categoria:       producto.categoria,
        subcategoria:    producto.subcategoria ?? '',
        descripcion:     producto.descripcion ?? '',
        precio:          String(producto.precio),
        precio_original: producto.precio_original != null ? String(producto.precio_original) : '',
        unidad:          producto.unidad,
        stock:           producto.stock != null ? String(producto.stock) : '',
        vigencia:        producto.vigencia ?? '',
        tags:            producto.tags ?? [],
        destacado:       producto.destacado,
        activo:          producto.activo,
        tipos_entrega:   producto.tipos_entrega ?? ['manual'],
        archivo_url:     producto.archivo_url ?? '',
        contenido_entrega: producto.contenido_entrega ?? '',
        mensaje_entrega: producto.mensaje_entrega ?? '',
        pdf_contexto_url: producto.pdf_contexto_url ?? '',
      })
    } else {
      setForm(emptyForm())
    }
  }, [open, producto])

  const set = <K extends keyof FormData>(field: K, value: FormData[K]) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const toggleEntrega = (val: string) => {
    const arr = form.tipos_entrega
    set('tipos_entrega', arr.includes(val) ? arr.filter(t => t !== val) : [...arr, val])
  }

  const handleSubmit = async () => {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    if (!form.precio || isNaN(Number(form.precio)) || Number(form.precio) < 0) {
      setError('El precio es inválido'); return
    }
    if (form.tipos_entrega.length === 0) { setError('Selecciona al menos una forma de entrega'); return }

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
          precio_original: form.precio_original ? Number(form.precio_original) : null,
          stock: form.stock ? Number(form.stock) : null,
          subcategoria: form.subcategoria.trim() || null,
          descripcion: form.descripcion.trim() || null,
          vigencia: form.vigencia.trim() || null,
          archivo_url: form.archivo_url || null,
          contenido_entrega: form.contenido_entrega.trim() || null,
          mensaje_entrega: form.mensaje_entrega.trim() || null,
          pdf_contexto_url: form.pdf_contexto_url || null,
        }),
      })
      if (!res.ok) { const e = await res.json(); setError(e.error ?? 'Error al guardar'); return }
      onSaved(await res.json())
      onClose()
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <h2 className="text-base font-bold text-zinc-900">
              {producto ? 'Editar producto digital' : 'Nuevo producto digital'}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Guarda todo lo necesario para que el bot lo venda por WhatsApp
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 transition">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-100 px-6">
          {(['datos', 'entrega'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                'py-2.5 px-1 mr-6 text-sm font-medium border-b-2 -mb-px transition',
                tab === t ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'
              )}>
              {t === 'datos' ? '1 · Datos del producto' : '2 · Entrega'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          {tab === 'datos' && (
            <>
              {/* Nombre */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Nombre <span className="text-red-400">*</span>
                </label>
                <input type="text" value={form.nombre}
                  onChange={e => set('nombre', e.target.value)}
                  placeholder="Ej: Curso de Instalaciones Eléctricas"
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              {/* Categoría + Subcategoría */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Categoría <span className="text-red-400">*</span>
                  </label>
                  <select value={form.categoria} onChange={e => set('categoria', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white">
                    <option value="General">General</option>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Subcategoría</label>
                  <input type="text" value={form.subcategoria}
                    onChange={e => set('subcategoria', e.target.value)}
                    placeholder="ej: electricidad, plomería…"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>

              {/* Descripción + Generar con PDF */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-zinc-700">Descripción</label>
                  <span className="text-[10px] text-violet-600 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    El bot usa este campo como contexto de ventas
                  </span>
                </div>
                <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
                  rows={4} placeholder="Describe el producto con detalle, o usa el botón de abajo para generarlo desde un PDF."
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
                />
                {/* PDF → Generar descripción con IA */}
                <div className="mt-2 p-3 bg-violet-50 border border-violet-200 rounded-lg space-y-2">
                  <p className="text-[10px] font-medium text-violet-700 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Generar descripción completa desde un PDF
                  </p>
                  {form.pdf_contexto_url ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 flex-1 p-1.5 bg-white border border-violet-200 rounded text-[10px] text-violet-700">
                        <FileText className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">PDF cargado</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => set('pdf_contexto_url', '')}
                        className="p-1 hover:bg-violet-100 rounded transition"
                      >
                        <X className="w-3.5 h-3.5 text-violet-400" />
                      </button>
                      <button
                        type="button"
                        disabled={generating}
                        onClick={async () => {
                          setGenerating(true)
                          setError('')
                          try {
                            const res = await fetch('/api/catalog/digital/ai-contexto', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                pdf_url: form.pdf_contexto_url,
                                nombre: form.nombre,
                                categoria: form.categoria,
                                subcategoria: form.subcategoria,
                                precio: Number(form.precio) || 0,
                                precio_original: form.precio_original ? Number(form.precio_original) : null,
                                unidad: form.unidad,
                                vigencia: form.vigencia,
                                tags: form.tags,
                                tipos_entrega: form.tipos_entrega,
                              }),
                            })
                            if (res.ok) {
                              const data = await res.json()
                              set('descripcion', data.texto)
                            } else {
                              const e = await res.json()
                              setError(e.error ?? 'Error al generar')
                            }
                          } catch {
                            setError('Error de conexión al generar')
                          } finally {
                            setGenerating(false)
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-[10px] font-semibold hover:bg-violet-700 disabled:opacity-50 transition whitespace-nowrap"
                      >
                        {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {generating ? 'Generando...' : 'Generar descripción'}
                      </button>
                    </div>
                  ) : (
                    <FileUploader
                      value={form.pdf_contexto_url}
                      onChange={v => set('pdf_contexto_url', v)}
                      accept=".pdf"
                      hint="Solo PDF · hasta 50 MB"
                    />
                  )}
                </div>
              </div>

              {/* Precio + Precio original + Unidad */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Precio S/ <span className="text-red-400">*</span>
                  </label>
                  <input type="number" min="0" step="0.01" value={form.precio}
                    onChange={e => set('precio', e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Precio original S/</label>
                  <input type="number" min="0" step="0.01" value={form.precio_original}
                    onChange={e => set('precio_original', e.target.value)} placeholder="Vacío = sin descuento"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Unidad</label>
                  <input type="text" value={form.unidad} onChange={e => set('unidad', e.target.value)}
                    placeholder="cupo, licencia…"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>

              {/* Stock + Vigencia */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Stock disponible</label>
                  <input type="number" min="0" value={form.stock}
                    onChange={e => set('stock', e.target.value)} placeholder="Vacío = ilimitado"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Vigencia del acceso</label>
                  <input type="text" value={form.vigencia} onChange={e => set('vigencia', e.target.value)}
                    placeholder="de por vida, 1 año, 6 meses…"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Etiquetas
                  <span className="ml-1 text-zinc-400 font-normal">(el bot las usa para encontrar el producto)</span>
                </label>
                <TagInput tags={form.tags} onChange={v => set('tags', v)} />
              </div>

              {/* Activo + Destacado */}
              <div className="flex gap-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.activo} onChange={e => set('activo', e.target.checked)}
                    className="w-4 h-4 rounded accent-zinc-900" />
                  <span className="text-sm text-zinc-700">Producto activo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.destacado} onChange={e => set('destacado', e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500" />
                  <span className="text-sm text-zinc-700">
                    Destacado <span className="text-zinc-400">(el bot lo menciona primero)</span>
                  </span>
                </label>
              </div>
            </>
          )}

          {tab === 'entrega' && (
            <>
              {/* Tipos de entrega */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-2">
                  Formas de entrega <span className="text-red-400">*</span>
                  <span className="ml-1 text-zinc-400 font-normal">(puedes seleccionar varias)</span>
                </label>
                <div className="space-y-2">
                  {TIPOS_ENTREGA.map(({ value, label, desc, Icon }) => {
                    const sel = form.tipos_entrega.includes(value)
                    return (
                      <button key={value} type="button" onClick={() => toggleEntrega(value)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition',
                          sel ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 bg-white hover:border-zinc-300'
                        )}>
                        <Icon className={cn('w-4 h-4 shrink-0', sel ? 'text-zinc-900' : 'text-zinc-400')} />
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-xs font-semibold', sel ? 'text-zinc-900' : 'text-zinc-600')}>{label}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>
                        </div>
                        <div className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition',
                          sel ? 'bg-zinc-900 border-zinc-900' : 'border-zinc-300'
                        )}>
                          {sel && <span className="text-white text-[10px] font-bold">✓</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Upload del archivo */}
              {form.tipos_entrega.includes('descarga') && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Archivo del producto</label>
                  <FileUploader value={form.archivo_url} onChange={v => set('archivo_url', v)} />
                </div>
              )}

              {/* Link / Clave de entrega */}
              {(form.tipos_entrega.includes('link') || form.tipos_entrega.includes('clave')) && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    {form.tipos_entrega.includes('link') && form.tipos_entrega.includes('clave')
                      ? 'Link o clave de entrega'
                      : form.tipos_entrega.includes('link') ? 'Link de acceso' : 'Clave de activación'}
                  </label>
                  <input type="text" value={form.contenido_entrega}
                    onChange={e => set('contenido_entrega', e.target.value)}
                    placeholder={form.tipos_entrega.includes('link')
                      ? 'https://drive.google.com/...'
                      : 'Clave: ABC-123-XYZ'}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              )}

              {/* Mensaje de entrega */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Mensaje de entrega al cliente
                  <span className="ml-1 text-zinc-400 font-normal">
                    — variables: {'{{nombre}}'}, {'{{link}}'}, {'{{clave}}'}
                  </span>
                </label>
                <textarea value={form.mensaje_entrega}
                  onChange={e => set('mensaje_entrega', e.target.value)}
                  rows={4}
                  placeholder={`Hola {{nombre}} 👋\nAquí tu acceso:\n\n🔗 {{link}}\n\n¡Gracias por tu compra!`}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none font-mono"
                />
                <p className="text-xs text-zinc-400 mt-1">
                  {form.tipos_entrega.includes('manual')
                    ? 'Con entrega manual, este texto aparece como sugerencia para que lo copies y envíes tú mismo.'
                    : 'El bot enviará este mensaje automáticamente cuando el pago esté confirmado.'}
                </p>
              </div>

              {/* Nota: PDF se gestiona en tab Datos */}
              {form.pdf_contexto_url && (
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg flex items-center gap-2 text-xs text-violet-700">
                  <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                  PDF de referencia cargado. Puedes generar la descripción desde la pestaña <strong>1 · Datos</strong>.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100">
          {tab === 'entrega' ? (
            <button type="button" onClick={() => setTab('datos')}
              className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition">
              ← Datos del producto
            </button>
          ) : (
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition">
              Cancelar
            </button>
          )}
          {tab === 'datos' ? (
            <button type="button" onClick={() => setTab('entrega')}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition">
              Siguiente: entrega →
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl disabled:opacity-50 transition">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {producto ? 'Guardar cambios' : 'Crear producto'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

function ProductoCard({ producto, onEdit, onDelete, onToggle, onUpdated }: {
  producto: ProductoDigital
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onUpdated: (p: ProductoDigital) => void
}) {
  const CatIcon = getCatIcon(producto.categoria)
  const descuento = producto.precio_original && producto.precio_original > producto.precio
    ? Math.round((1 - producto.precio / producto.precio_original) * 100)
    : null

  return (
    <div className={cn(
      'bg-white rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow flex flex-col',
      !producto.activo && 'opacity-60'
    )}>
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <div className="p-2 rounded-xl bg-zinc-100 shrink-0">
          <CatIcon className="w-5 h-5 text-zinc-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-violet-50 border border-violet-200 text-violet-700">
              {producto.categoria}
            </span>
            {producto.destacado && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 border border-amber-200 text-amber-700">
                <Star className="w-2.5 h-2.5" /> Destacado
              </span>
            )}
            {!producto.activo && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 text-zinc-400">
                Inactivo
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-zinc-900 leading-tight line-clamp-2">{producto.nombre}</h3>
          {producto.subcategoria && (
            <p className="text-[10px] text-zinc-400 mt-0.5">{producto.subcategoria}</p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-3 space-y-2.5 flex-1">
        {/* Descripción */}
        {producto.descripcion && (
          <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{producto.descripcion}</p>
        )}

        {/* Precio */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xl font-black text-zinc-900">{formatPEN(producto.precio)}</span>
          <span className="text-xs text-zinc-400">/ {producto.unidad}</span>
          {producto.precio_original && (
            <span className="text-xs text-zinc-400 line-through">{formatPEN(producto.precio_original)}</span>
          )}
          {descuento && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
              -{descuento}%
            </span>
          )}
        </div>

        {/* Tipos de entrega */}
        {producto.tipos_entrega.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {producto.tipos_entrega.map(t => {
              const cfg = TIPOS_ENTREGA.find(x => x.value === t)
              if (!cfg) return null
              const Icon = cfg.Icon
              return (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                  <Icon className="w-2.5 h-2.5" />
                  {cfg.label}
                </span>
              )
            })}
          </div>
        )}

        {/* Chips info */}
        <div className="flex flex-wrap gap-1">
          {producto.vigencia && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
              {producto.vigencia}
            </span>
          )}
          {producto.stock != null && (
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border',
              producto.stock <= 3
                ? 'bg-red-50 text-red-700 border-red-100'
                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
            )}>
              {producto.stock} disponibles
            </span>
          )}
          {producto.archivo_url && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
              <Download className="w-2.5 h-2.5" /> Archivo listo
            </span>
          )}
        </div>

        {/* Tags */}
        {producto.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center">
            <Tag className="w-3 h-3 text-zinc-300 shrink-0" />
            {producto.tags.map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-500">{tag}</span>
            ))}
          </div>
        )}

        {/* Contextualizador */}
        <CtxBox producto={producto} onUpdated={onUpdated} />
      </div>

      {/* Footer */}
      <div className="mt-auto px-4 py-3 border-t border-zinc-100 flex items-center gap-2">
        <button onClick={onToggle}
          className={cn(
            'flex-1 py-1.5 rounded-lg text-xs font-medium transition',
            producto.activo
              ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          )}>
          {producto.activo ? 'Desactivar' : 'Activar'}
        </button>
        <button onClick={onEdit}
          className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition" title="Editar">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={onDelete}
          className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition" title="Eliminar">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="text-center py-20">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-50 border-2 border-dashed border-violet-200 mb-4">
        <Sparkles className="w-7 h-7 text-violet-400" />
      </div>
      <h3 className="text-base font-bold text-zinc-800 mb-1">Aún no tienes productos digitales</h3>
      <p className="text-sm text-zinc-400 max-w-xs mx-auto mb-6">
        Cursos, licencias, servicios, archivos — créalos aquí y el bot los vende por WhatsApp automáticamente.
      </p>
      <button onClick={onNew}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition">
        <Plus className="w-4 h-4" /> Crear primer producto digital
      </button>
    </div>
  )
}

// ── Principal ─────────────────────────────────────────────────────────────────

export default function DigitalProductsClient({ initial }: { initial: ProductoDigital[] }) {
  const [productos, setProductos] = useState<ProductoDigital[]>(initial)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<ProductoDigital | null>(null)
  const [eliminando, setEliminando] = useState<ProductoDigital | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos')

  const categorias = Array.from(new Set(productos.map(p => p.categoria))).filter(Boolean)

  const filtrados = productos.filter(p => {
    const q = busqueda.toLowerCase()
    const matchQ = !q
      || p.nombre.toLowerCase().includes(q)
      || (p.descripcion ?? '').toLowerCase().includes(q)
      || p.tags.some(t => t.includes(q))
      || p.categoria.toLowerCase().includes(q)
    const matchCat = filtroCategoria === 'todos' || p.categoria === filtroCategoria
    return matchQ && matchCat
  })

  const openNew = () => { setEditando(null); setModalOpen(true) }
  const openEdit = (p: ProductoDigital) => { setEditando(p); setModalOpen(true) }

  const handleSaved = useCallback((saved: ProductoDigital) => {
    setProductos(prev => {
      const idx = prev.findIndex(p => p.id === saved.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n }
      return [saved, ...prev]
    })
  }, [])

  const handleToggle = async (p: ProductoDigital) => {
    const res = await fetch(`/api/catalog/digital/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !p.activo }),
    })
    if (res.ok) handleSaved(await res.json())
  }

  const handleDelete = async () => {
    if (!eliminando) return
    const res = await fetch(`/api/catalog/digital/${eliminando.id}`, { method: 'DELETE' })
    if (res.ok) { setProductos(prev => prev.filter(p => p.id !== eliminando.id)); setEliminando(null) }
  }

  return (
    <div>
      {/* Cabecera */}
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
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition">
          <Plus className="w-4 h-4" /> Nuevo producto
        </button>
      </div>

      {/* Filtros */}
      {productos.length > 0 && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto, etiqueta o categoría..."
            className="px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 w-64"
          />
          <div className="flex gap-1.5 flex-wrap">
            {['todos', ...categorias].map(cat => (
              <button key={cat} onClick={() => setFiltroCategoria(cat)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg border transition',
                  filtroCategoria === cat
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400'
                )}>
                {cat === 'todos' ? 'Todos' : cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {productos.length === 0 ? (
        <EmptyState onNew={openNew} />
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 text-sm text-zinc-400">
          Sin resultados para &quot;{busqueda}&quot;
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map(p => (
            <ProductoCard key={p.id} producto={p}
              onEdit={() => openEdit(p)}
              onDelete={() => setEliminando(p)}
              onToggle={() => handleToggle(p)}
              onUpdated={handleSaved}
            />
          ))}
        </div>
      )}

      {/* Modal crear / editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        producto={editando} onSaved={handleSaved} />

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
              <button onClick={() => setEliminando(null)}
                className="flex-1 py-2.5 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition">
                Cancelar
              </button>
              <button onClick={handleDelete}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
