'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, RotateCcw, Eye, AlertTriangle, Check, Save, X, Bot, Wrench, Globe } from 'lucide-react'

interface Seccion {
  key:       string
  label:     string
  avanzado:  boolean
  texto:     string
  esDefault: boolean
}

interface Tag {
  tag:   string
  label: string
}

interface ToolDef {
  name:   string
  label:  string
  desc:   string
  nucleo?: boolean
}

interface AgentDef {
  id:     string
  label:  string
  accent: string
  tools:  ToolDef[]
}

// ── SeccionCard — Capa 1 ───────────────────────────────────────────────────────
function SeccionCard({
  seccion, savedTexto, onChange, onSave, onReset, tags, saving, justSaved,
}: {
  seccion: Seccion; savedTexto: string; onChange: (t: string) => void
  onSave: () => void; onReset: () => void; tags: Tag[]; saving: boolean; justSaved: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dirty = seccion.texto !== savedTexto

  const insertarTag = (tag: string) => {
    const el = textareaRef.current
    if (!el) return
    const s = el.selectionStart ?? seccion.texto.length
    const e = el.selectionEnd   ?? seccion.texto.length
    onChange(seccion.texto.slice(0, s) + tag + seccion.texto.slice(e))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + tag.length, s + tag.length) })
  }

  return (
    <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-900">{seccion.label}</h4>
        <button onClick={onReset} disabled={seccion.esDefault || saving}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-indigo-600 disabled:text-zinc-300 disabled:cursor-not-allowed transition">
          <RotateCcw className="w-3 h-3" /> Restablecer
        </button>
      </div>
      <textarea ref={textareaRef} value={seccion.texto} onChange={e => onChange(e.target.value)} rows={6}
        className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y" />
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {tags.map(t => (
            <button key={t.tag} onClick={() => insertarTag(t.tag)} title={t.label}
              className="px-2 py-0.5 text-[11px] font-mono bg-zinc-100 hover:bg-indigo-100 hover:text-indigo-700 text-zinc-600 rounded-md transition">
              {t.tag}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-zinc-400 shrink-0 ml-2">{seccion.texto.length}/8000</span>
      </div>
      <div className="flex items-center justify-between pt-1">
        {!seccion.esDefault
          ? <p className="text-[11px] text-indigo-600 font-medium">● Personalizado</p>
          : <span />}
        <button onClick={onSave} disabled={!dirty || saving}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
            dirty ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'}`}>
          {saving ? <>⏳ Guardando...</> : justSaved && !dirty
            ? <><Check className="w-3.5 h-3.5" /> Guardado</>
            : <><Save className="w-3.5 h-3.5" /> Guardar</>}
        </button>
      </div>
    </div>
  )
}

// ── InstruccionTextarea — genérico para Capas 2/3/4 ──────────────────────────
function InstruccionTextarea({
  label, hint, value, savedValue, onChange, onSave, saving, justSaved, maxLen = 2000, rows = 4,
}: {
  label: string; hint?: string; value: string; savedValue: string
  onChange: (t: string) => void; onSave: () => void
  saving: boolean; justSaved: boolean; maxLen?: number; rows?: number
}) {
  const dirty = value !== savedValue
  return (
    <div className="space-y-2">
      {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
        placeholder={`Instrucciones específicas para ${label}...`}
        className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y" />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-400">{value.length}/{maxLen}</span>
        <button onClick={onSave} disabled={!dirty || saving}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
            dirty ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'}`}>
          {saving ? <>⏳...</> : justSaved && !dirty
            ? <><Check className="w-3 h-3" /> Guardado</>
            : <><Save className="w-3 h-3" /> Guardar</>}
        </button>
      </div>
    </div>
  )
}

// ── Preview Modal — 4 capas ───────────────────────────────────────────────────
function PreviewModal({
  secciones, instruccionesExtra, instruccionesAgentes, instruccionesTools,
  registry, agentesActivos, vars, onClose,
}: {
  secciones: Seccion[]; instruccionesExtra: string
  instruccionesAgentes: Record<string, string>; instruccionesTools: Record<string, string>
  registry: AgentDef[]; agentesActivos: string[]
  vars: Record<string, string>; onClose: () => void
}) {
  const LAYER_COLORS: Record<string, string> = {
    capa1: 'bg-violet-100 text-violet-700 border-violet-200',
    capa2: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    capa3: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    capa4: 'bg-amber-100  text-amber-700  border-amber-200',
    vars:  'bg-zinc-100   text-zinc-600   border-zinc-200',
  }

  const agenteActivos = registry.filter(a => agentesActivos.includes(a.id))
  const agentesConInstruccion = agenteActivos.filter(a => instruccionesAgentes[a.id]?.trim())
  const toolsConNota = registry.flatMap(a => a.tools).filter(t => instruccionesTools[t.name]?.trim())

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 shrink-0">
          <h3 className="text-sm font-bold text-zinc-900">Estructura del prompt por capas</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">

          {/* Variables */}
          <div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border mb-2 ${LAYER_COLORS.vars}`}>
              Variables del negocio
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(vars).map(([k, v]) => (
                <div key={k} className="bg-zinc-50 rounded-lg px-2.5 py-1.5 text-[11px]">
                  <span className="font-mono text-zinc-400">{`{${k}}`}</span>
                  <span className="text-zinc-700 ml-2 truncate">{v || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Capa 1 */}
          <div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border mb-2 ${LAYER_COLORS.capa1}`}>
              Capa 1 — Secciones del prompt ({secciones.filter(s => !s.esDefault).length} personalizadas)
            </div>
            <div className="space-y-2">
              {secciones.map(s => (
                <details key={s.key} className="border border-zinc-200 rounded-lg overflow-hidden">
                  <summary className="px-3 py-2 text-xs font-medium text-zinc-700 cursor-pointer select-none flex items-center justify-between hover:bg-zinc-50">
                    <span>{s.label}</span>
                    {!s.esDefault && <span className="text-[10px] text-indigo-600 font-semibold">personalizado</span>}
                  </summary>
                  <pre className="px-3 pb-3 text-[11px] font-mono whitespace-pre-wrap text-zinc-600 bg-zinc-50 border-t border-zinc-100">
                    {s.texto}
                  </pre>
                </details>
              ))}
            </div>
          </div>

          {/* Capa 2 */}
          <div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border mb-2 ${LAYER_COLORS.capa2}`}>
              Capa 2 — Instrucciones globales extra
            </div>
            {instruccionesExtra.trim()
              ? <pre className="text-[11px] font-mono whitespace-pre-wrap text-zinc-700 bg-indigo-50 border border-indigo-100 rounded-lg p-3">{instruccionesExtra}</pre>
              : <p className="text-[11px] text-zinc-400 italic">Sin instrucciones extra</p>}
          </div>

          {/* Capa 3 */}
          <div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border mb-2 ${LAYER_COLORS.capa3}`}>
              Capa 3 — Instrucciones por agente ({agentesConInstruccion.length} con instrucción)
            </div>
            {agentesConInstruccion.length === 0
              ? <p className="text-[11px] text-zinc-400 italic">Sin instrucciones por agente</p>
              : <div className="space-y-2">
                  {agentesConInstruccion.map(a => (
                    <div key={a.id} className="border border-zinc-200 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-zinc-50 text-xs font-medium text-zinc-700 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.accent }} />
                        {a.label}
                      </div>
                      <pre className="px-3 py-2 text-[11px] font-mono whitespace-pre-wrap text-zinc-600 border-t border-zinc-100">
                        {instruccionesAgentes[a.id]}
                      </pre>
                    </div>
                  ))}
                </div>}
          </div>

          {/* Capa 4 */}
          <div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border mb-2 ${LAYER_COLORS.capa4}`}>
              Capa 4 — Notas por herramienta ({toolsConNota.length} con nota)
            </div>
            {toolsConNota.length === 0
              ? <p className="text-[11px] text-zinc-400 italic">Sin notas por herramienta</p>
              : <div className="space-y-2">
                  {toolsConNota.map(t => (
                    <div key={t.name} className="border border-zinc-200 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-zinc-50 text-xs font-medium text-zinc-700 font-mono">{t.name}</div>
                      <pre className="px-3 py-2 text-[11px] font-mono whitespace-pre-wrap text-zinc-600 border-t border-zinc-100">
                        {instruccionesTools[t.name]}
                      </pre>
                    </div>
                  ))}
                </div>}
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function BotPromptTab() {
  const [secciones,                  setSecciones]                  = useState<Seccion[]>([])
  const [guardadas,                  setGuardadas]                  = useState<Record<string, string>>({})
  const [tags,                       setTags]                       = useState<Tag[]>([])
  const [instruccionesExtra,         setInstruccionesExtra]         = useState('')
  const [instruccionesExtraGuardada, setInstruccionesExtraGuardada] = useState('')
  const [instruccionesAgentes,       setInstruccionesAgentes]       = useState<Record<string, string>>({})
  const [instruccionesAgentesGuard,  setInstruccionesAgentesGuard]  = useState<Record<string, string>>({})
  const [instruccionesTools,         setInstruccionesTools]         = useState<Record<string, string>>({})
  const [instruccionesToolsGuard,    setInstruccionesToolsGuard]    = useState<Record<string, string>>({})
  const [registry,                   setRegistry]                   = useState<AgentDef[]>([])
  const [agentesActivos,             setAgentesActivos]             = useState<string[]>([])
  const [vars,                       setVars]                       = useState<Record<string, string>>({})

  const [loading,             setLoading]             = useState(true)
  const [saving,              setSaving]              = useState<string | null>(null)
  const [justSaved,           setJustSaved]           = useState<string | null>(null)
  const [avanzadoAbierto,     setAvanzadoAbierto]     = useState(false)
  const [agentesAbiertos,     setAgentesAbiertos]     = useState<Set<string>>(new Set())
  const [herramientasAbierto, setHerramientasAbierto] = useState(false)
  const [previewAbierto,      setPreviewAbierto]      = useState(false)
  const [confirmReset,        setConfirmReset]        = useState(false)

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings-2/bot/prompt')
      if (!res.ok) return
      const json = await res.json()
      const secs: Seccion[] = json.secciones ?? []
      setSecciones(secs)
      setGuardadas(Object.fromEntries(secs.map((s: Seccion) => [s.key, s.texto])))
      setTags(json.tags ?? [])
      setInstruccionesExtra(json.instrucciones_extra ?? '')
      setInstruccionesExtraGuardada(json.instrucciones_extra ?? '')
      setInstruccionesAgentes(json.instrucciones_agentes ?? {})
      setInstruccionesAgentesGuard(json.instrucciones_agentes ?? {})
      setInstruccionesTools(json.instrucciones_tools ?? {})
      setInstruccionesToolsGuard(json.instrucciones_tools ?? {})
      setRegistry(json.registry ?? [])
      setAgentesActivos(json.agentes_activos ?? [])
      setVars(json.vars ?? {})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  // Capa 1 — sección del prompt
  const setTexto = (key: string, texto: string) => {
    setSecciones(prev => prev.map(s => s.key === key ? { ...s, texto, esDefault: false } : s))
    setJustSaved(null)
  }
  const guardar = async (key: string) => {
    const sec = secciones.find(s => s.key === key)
    if (!sec) return
    setSaving(key)
    try {
      const res = await fetch('/api/settings-2/bot/prompt', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, texto: sec.texto }),
      })
      if (res.ok) { setGuardadas(p => ({ ...p, [key]: sec.texto })); setJustSaved(key) }
    } finally { setSaving(null) }
  }
  const resetear = async (key: string) => {
    setSaving(key)
    try {
      await fetch('/api/settings-2/bot/prompt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      await cargar()
    } finally { setSaving(null) }
  }

  // Capa 2 — instrucciones_extra
  const guardarExtra = async () => {
    setSaving('__extra__')
    try {
      const res = await fetch('/api/settings-2/bot/prompt', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instrucciones_extra: instruccionesExtra }),
      })
      if (res.ok) { setInstruccionesExtraGuardada(instruccionesExtra); setJustSaved('__extra__') }
    } finally { setSaving(null) }
  }

  // Capa 3 — instrucciones por agente
  const guardarAgente = async (id: string) => {
    setSaving(`agente_${id}`)
    try {
      const res = await fetch('/api/settings-2/bot/agentes', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruccion_agente: { id, texto: instruccionesAgentes[id] ?? '' } }),
      })
      if (res.ok) {
        setInstruccionesAgentesGuard(p => ({ ...p, [id]: instruccionesAgentes[id] ?? '' }))
        setJustSaved(`agente_${id}`)
      }
    } finally { setSaving(null) }
  }

  // Capa 4 — notas por herramienta
  const guardarTool = async (name: string) => {
    setSaving(`tool_${name}`)
    try {
      const res = await fetch('/api/settings-2/bot/agentes', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruccion_tool: { name, texto: instruccionesTools[name] ?? '' } }),
      })
      if (res.ok) {
        setInstruccionesToolsGuard(p => ({ ...p, [name]: instruccionesTools[name] ?? '' }))
        setJustSaved(`tool_${name}`)
      }
    } finally { setSaving(null) }
  }

  // Deep factory reset
  const resetearTodo = async () => {
    setSaving('__all__')
    setConfirmReset(false)
    try {
      await fetch('/api/settings-2/bot/prompt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true, deep: true }),
      })
      await cargar()
    } finally { setSaving(null) }
  }

  const toggleAgente = (id: string) =>
    setAgentesAbiertos(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  if (loading) return <div className="text-sm text-zinc-500 py-8 text-center">Cargando...</div>

  const basicas    = secciones.filter(s => !s.avanzado)
  const avanzadas  = secciones.filter(s => s.avanzado)
  const hayChanges =
    secciones.some(s => !s.esDefault) ||
    instruccionesExtra.trim() ||
    Object.values(instruccionesAgentesGuard).some(v => v.trim()) ||
    Object.values(instruccionesToolsGuard).some(v => v.trim())

  const agentesFiltrados = registry.filter(a => agentesActivos.includes(a.id))
  const todasLasTools    = registry.flatMap(a => a.tools)

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500 max-w-md">
          El prompt del bot se construye por capas. Aquí puedes editar cada capa manualmente o dejar que el Asistente IA lo haga por ti.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setPreviewAbierto(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-indigo-600 border border-zinc-200 rounded-lg transition">
            <Eye className="w-3.5 h-3.5" /> Vista por capas
          </button>
          <button onClick={() => setConfirmReset(true)} disabled={!hayChanges || saving === '__all__'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-rose-600 border border-zinc-200 rounded-lg disabled:text-zinc-300 disabled:cursor-not-allowed transition">
            <RotateCcw className="w-3.5 h-3.5" /> Restablecer fábrica
          </button>
        </div>
      </div>

      {/* Confirm reset dialog */}
      {confirmReset && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-rose-800">¿Restablecer todo a valores de fábrica?</p>
            <p className="text-xs text-rose-700 mt-1">
              Esto borrará todas las personalizaciones: secciones del prompt, instrucciones globales, por agente y por herramienta. No se puede deshacer.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setConfirmReset(false)}
              className="px-3 py-1.5 text-xs font-medium text-zinc-600 border border-zinc-200 bg-white rounded-lg hover:bg-zinc-50 transition">
              Cancelar
            </button>
            <button onClick={resetearTodo}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition">
              Sí, restablecer todo
            </button>
          </div>
        </div>
      )}

      {/* ── Capa 1: Secciones del prompt ─────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
          <h3 className="text-sm font-semibold text-zinc-800">Secciones del prompt</h3>
          <span className="text-xs text-zinc-400">— identidad, reglas y flujo del bot</span>
        </div>
        <div className="space-y-3 ml-7">
          {basicas.map(s => (
            <SeccionCard key={s.key} seccion={s} savedTexto={guardadas[s.key] ?? s.texto}
              tags={tags} saving={saving === s.key} justSaved={justSaved === s.key}
              onChange={t => setTexto(s.key, t)} onSave={() => guardar(s.key)} onReset={() => resetear(s.key)} />
          ))}
        </div>

        {/* Avanzado */}
        <div className="ml-7 border border-zinc-200 rounded-xl overflow-hidden">
          <button onClick={() => setAvanzadoAbierto(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 bg-zinc-50 hover:bg-zinc-100 transition">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-zinc-700">Secciones avanzadas</span>
              <span className="text-xs text-zinc-400">— anti-alucinación, flujo de pedido</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${avanzadoAbierto ? 'rotate-180' : ''}`} />
          </button>
          {avanzadoAbierto && (
            <div className="p-5 space-y-4 bg-white">
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Estas reglas evitan que el bot invente precios o confirme pedidos falsos. Edita solo si sabes lo que haces.
              </p>
              {avanzadas.map(s => (
                <SeccionCard key={s.key} seccion={s} savedTexto={guardadas[s.key] ?? s.texto}
                  tags={tags} saving={saving === s.key} justSaved={justSaved === s.key}
                  onChange={t => setTexto(s.key, t)} onSave={() => guardar(s.key)} onReset={() => resetear(s.key)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Capa 2: Instrucciones globales extra ─────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
          <h3 className="text-sm font-semibold text-zinc-800">Instrucciones globales extra</h3>
        </div>
        <div className="ml-7 p-5 bg-white border border-zinc-200 rounded-xl">
          <InstruccionTextarea
            label="el bot"
            hint="Reglas adicionales que aplican a todo el bot — sin importar el agente o herramienta activa."
            value={instruccionesExtra}
            savedValue={instruccionesExtraGuardada}
            onChange={setInstruccionesExtra}
            onSave={guardarExtra}
            saving={saving === '__extra__'}
            justSaved={justSaved === '__extra__'}
            maxLen={2000}
            rows={4}
          />
        </div>
      </div>

      {/* ── Capa 3: Instrucciones por agente ─────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
          <h3 className="text-sm font-semibold text-zinc-800">Instrucciones por agente</h3>
          <span className="text-xs text-zinc-400">— solo se aplican cuando ese agente está activo</span>
        </div>

        {agentesFiltrados.length === 0 ? (
          <p className="ml-7 text-xs text-zinc-400 italic">No hay agentes activos. Actívalos en la pestaña Agentes.</p>
        ) : (
          <div className="ml-7 space-y-2">
            {agentesFiltrados.map(agente => {
              const open     = agentesAbiertos.has(agente.id)
              const tieneVal = instruccionesAgentesGuard[agente.id]?.trim()
              return (
                <div key={agente.id} className="border border-zinc-200 rounded-xl overflow-hidden">
                  <button onClick={() => toggleAgente(agente.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 hover:bg-zinc-100 transition">
                    <div className="flex items-center gap-2.5">
                      <Bot className="w-4 h-4 text-zinc-400" />
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: agente.accent }} />
                      <span className="text-sm font-medium text-zinc-700">{agente.label}</span>
                      {tieneVal && (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">
                          con instrucción
                        </span>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <div className="p-4 bg-white border-t border-zinc-100">
                      <InstruccionTextarea
                        label={agente.label}
                        value={instruccionesAgentes[agente.id] ?? ''}
                        savedValue={instruccionesAgentesGuard[agente.id] ?? ''}
                        onChange={v => setInstruccionesAgentes(p => ({ ...p, [agente.id]: v }))}
                        onSave={() => guardarAgente(agente.id)}
                        saving={saving === `agente_${agente.id}`}
                        justSaved={justSaved === `agente_${agente.id}`}
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Capa 4: Notas por herramienta ────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center shrink-0">4</span>
          <h3 className="text-sm font-semibold text-zinc-800">Notas por herramienta</h3>
          <span className="text-xs text-zinc-400">— instrucciones puntuales para una herramienta específica</span>
        </div>

        <div className="ml-7 border border-zinc-200 rounded-xl overflow-hidden">
          <button onClick={() => setHerramientasAbierto(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-zinc-50 hover:bg-zinc-100 transition">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-700">
                {todasLasTools.length} herramientas disponibles
              </span>
              {Object.values(instruccionesToolsGuard).some(v => v.trim()) && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                  {Object.values(instruccionesToolsGuard).filter(v => v.trim()).length} con nota
                </span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${herramientasAbierto ? 'rotate-180' : ''}`} />
          </button>

          {herramientasAbierto && (
            <div className="bg-white border-t border-zinc-100">
              {registry.map((agente, ai) => (
                <div key={agente.id}>
                  {ai > 0 && <div className="border-t border-zinc-100" />}
                  <div className="px-4 py-2 bg-zinc-50 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: agente.accent }} />
                    <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">{agente.label}</span>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {agente.tools.map(tool => (
                      <div key={tool.name} className="px-4 py-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="text-xs font-mono font-semibold text-zinc-700">{tool.name}</span>
                          <span className="text-[11px] text-zinc-400 truncate">{tool.desc}</span>
                        </div>
                        <div className="flex gap-2">
                          <textarea
                            value={instruccionesTools[tool.name] ?? ''}
                            onChange={e => setInstruccionesTools(p => ({ ...p, [tool.name]: e.target.value }))}
                            rows={2}
                            placeholder="Nota especial para esta herramienta..."
                            className="flex-1 px-2.5 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                          />
                          <button
                            onClick={() => guardarTool(tool.name)}
                            disabled={(instruccionesTools[tool.name] ?? '') === (instruccionesToolsGuard[tool.name] ?? '') || saving === `tool_${tool.name}`}
                            className="self-start flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition disabled:text-zinc-300 disabled:cursor-not-allowed bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-zinc-100">
                            {saving === `tool_${tool.name}` ? '...'
                              : justSaved === `tool_${tool.name}` && (instruccionesTools[tool.name] ?? '') === (instruccionesToolsGuard[tool.name] ?? '')
                              ? <><Check className="w-3 h-3" /></>
                              : <><Save className="w-3 h-3" /></>}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de preview */}
      {previewAbierto && (
        <PreviewModal
          secciones={secciones}
          instruccionesExtra={instruccionesExtra}
          instruccionesAgentes={instruccionesAgentesGuard}
          instruccionesTools={instruccionesToolsGuard}
          registry={registry}
          agentesActivos={agentesActivos}
          vars={vars}
          onClose={() => setPreviewAbierto(false)}
        />
      )}
    </div>
  )
}
