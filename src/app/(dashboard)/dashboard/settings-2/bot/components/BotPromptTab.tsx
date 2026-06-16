'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, RotateCcw, Eye, AlertTriangle } from 'lucide-react'

interface Seccion {
  key: string
  label: string
  avanzado: boolean
  texto: string
  esDefault: boolean
}

interface Tag {
  tag: string
  label: string
}

function SeccionCard({
  seccion,
  onChange,
  onBlurSave,
  onReset,
  tags,
  saving,
}: {
  seccion: Seccion
  onChange: (texto: string) => void
  onBlurSave: () => void
  onReset: () => void
  tags: Tag[]
  saving: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertarTag = (tag: string) => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart ?? seccion.texto.length
    const end = el.selectionEnd ?? seccion.texto.length
    const nuevo = seccion.texto.slice(0, start) + tag + seccion.texto.slice(end)
    onChange(nuevo)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + tag.length, start + tag.length)
    })
  }

  return (
    <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-900">{seccion.label}</h4>
        <button
          onClick={onReset}
          disabled={seccion.esDefault || saving}
          title="Restablecer a predeterminado"
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-indigo-600 disabled:text-zinc-300 disabled:cursor-not-allowed transition"
        >
          <RotateCcw className="w-3 h-3" />
          Restablecer
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={seccion.texto}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlurSave}
        rows={6}
        className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-xs font-mono leading-relaxed
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
      />

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {tags.map(t => (
            <button
              key={t.tag}
              onClick={() => insertarTag(t.tag)}
              title={t.label}
              className="px-2 py-0.5 text-[11px] font-mono bg-zinc-100 hover:bg-indigo-100 hover:text-indigo-700 text-zinc-600 rounded-md transition"
            >
              {t.tag}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-zinc-400 shrink-0 ml-2">{seccion.texto.length}/8000</span>
      </div>

      {!seccion.esDefault && (
        <p className="text-[11px] text-indigo-600 font-medium">● Personalizado — distinto del predeterminado</p>
      )}
    </div>
  )
}

export default function BotPromptTab() {
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [avanzadoAbierto, setAvanzadoAbierto] = useState(false)
  const [previewAbierto, setPreviewAbierto] = useState(false)

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings-2/bot/prompt')
      if (res.ok) {
        const json = await res.json()
        setSecciones(json.secciones ?? [])
        setTags(json.tags ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const setTexto = (key: string, texto: string) => {
    setSecciones(prev => prev.map(s => s.key === key ? { ...s, texto, esDefault: false } : s))
  }

  const guardar = async (key: string, texto: string) => {
    setSaving(key)
    try {
      await fetch('/api/settings-2/bot/prompt', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, texto }),
      })
    } finally {
      setSaving(null)
    }
  }

  const resetear = async (key: string) => {
    setSaving(key)
    try {
      await fetch('/api/settings-2/bot/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      await cargar()
    } finally {
      setSaving(null)
    }
  }

  const resetearTodo = async () => {
    setSaving('__all__')
    try {
      await fetch('/api/settings-2/bot/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      await cargar()
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="text-sm text-zinc-500 py-8 text-center">Cargando...</div>

  const basicas = secciones.filter(s => !s.avanzado)
  const avanzadas = secciones.filter(s => s.avanzado)
  const hayOverrides = secciones.some(s => !s.esDefault)

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500 max-w-md">
          Este es el texto exacto que el bot usa como instrucciones. Cada cambio se guarda al salir del campo (blur).
          Usa los tags para insertar datos dinámicos del negocio.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setPreviewAbierto(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-indigo-600 border border-zinc-200 rounded-lg transition"
          >
            <Eye className="w-3.5 h-3.5" />
            Vista previa
          </button>
          <button
            onClick={resetearTodo}
            disabled={!hayOverrides || saving === '__all__'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-rose-600 border border-zinc-200 rounded-lg disabled:text-zinc-300 disabled:cursor-not-allowed transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restablecer todo
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {basicas.map(s => (
          <SeccionCard
            key={s.key}
            seccion={s}
            tags={tags}
            saving={saving === s.key}
            onChange={(texto) => setTexto(s.key, texto)}
            onBlurSave={() => guardar(s.key, secciones.find(sec => sec.key === s.key)?.texto ?? s.texto)}
            onReset={() => resetear(s.key)}
          />
        ))}
      </div>

      <div className="border border-zinc-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setAvanzadoAbierto(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-zinc-50 hover:bg-zinc-100 transition"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-zinc-700">Opciones avanzadas</span>
            <span className="text-xs text-zinc-400">— reglas críticas del bot (anti-alucinación, flujo de pedido)</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${avanzadoAbierto ? 'rotate-180' : ''}`} />
        </button>

        {avanzadoAbierto && (
          <div className="p-5 space-y-4 bg-white">
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Estas reglas evitan que el bot invente precios, productos o confirme pedidos falsos. Solo edítalas si sabes exactamente lo que quieres cambiar.
            </p>
            {avanzadas.map(s => (
              <SeccionCard
                key={s.key}
                seccion={s}
                tags={tags}
                saving={saving === s.key}
                onChange={(texto) => setTexto(s.key, texto)}
                onBlurSave={() => guardar(s.key, secciones.find(sec => sec.key === s.key)?.texto ?? s.texto)}
                onReset={() => resetear(s.key)}
              />
            ))}
          </div>
        )}
      </div>

      {previewAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setPreviewAbierto(false)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-zinc-900">Vista previa del prompt completo</h3>
              <button onClick={() => setPreviewAbierto(false)} className="text-zinc-400 hover:text-zinc-700 text-sm">Cerrar</button>
            </div>
            <pre className="text-[11px] font-mono whitespace-pre-wrap text-zinc-700 bg-zinc-50 p-4 rounded-lg border border-zinc-100">
{secciones.map(s => `# ${s.label}\n${s.texto}`).join('\n\n')}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
