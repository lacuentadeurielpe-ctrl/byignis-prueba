'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, ExternalLink, Wrench, StickyNote, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Tipos locales (espejo de registry.ts para no importar módulo server) ────────

interface ToolDef {
  name: string
  label: string
  desc: string
  nucleo?: boolean
  requiereIntegracion?: string
}

interface AgentDef {
  id: string
  label: string
  desc: string
  accent: string
  tools: ToolDef[]
}

interface ApiData {
  agentes:                   string[]
  herramientas_desactivadas: string[]
  instrucciones_agentes:     Record<string, string>
  registry:                  AgentDef[]
  core_tools:                ToolDef[]
}

// Placeholders de ejemplo por agente — orientan al dueño
const PLACEHOLDERS: Record<string, string> = {
  ventas:        'Ej: Si el cliente pide un presupuesto mayor a S/500, ofrecer siempre el precio por volumen. Mencionarle el plazo de entrega antes de confirmar.',
  comprobantes:  'Ej: Siempre pedir RUC si el monto supera S/700, aunque el cliente no lo solicite.',
  upsell:        'Ej: Para cemento, sugerir arena fina como complemento. Para pintura, sugerir brochas. Máximo una sugerencia por cotización.',
  crm:           'Ej: Si el cliente ya compró 3 o más veces, tratarlo como cliente preferencial y mencionarle los beneficios de fidelidad.',
  comunicaciones:'Ej: Enviar notificación por Telegram solo para pedidos mayores a S/300.',
  agenda:        'Ej: Para instalaciones técnicas, bloquear mínimo 2 horas en el calendario.',
  pagos:         'Ej: Si el cliente tiene deuda activa mayor a S/200, mencionársela amablemente antes de confirmar un pedido nuevo. Si supera los 30 días, escalar al encargado.',
  inventario:    'Ej: Si el stock de cemento baja de 50 bolsas, notificar inmediatamente al dueño.',
}

// ── Componente de instrucción por agente ─────────────────────────────────────

interface AgentInstruccionProps {
  agentId:       string
  agentLabel:    string
  agentOn:       boolean
  initialValue:  string
  onSaved:       (id: string, texto: string) => void
}

function AgentInstruccion({ agentId, agentLabel, agentOn, initialValue, onSaved }: AgentInstruccionProps) {
  const [texto,     setTexto]     = useState(initialValue)
  const [expanded,  setExpanded]  = useState(!!initialValue)
  const [status,    setStatus]    = useState<'idle' | 'saving' | 'saved' | 'clearing'>('idle')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const MAX = 3000
  const isDirty = texto !== initialValue
  const hasValue = texto.trim().length > 0

  async function guardar() {
    setStatus('saving')
    try {
      const res = await fetch('/api/settings-2/bot/agentes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruccion_agente: { id: agentId, texto } }),
      })
      if (res.ok) {
        setStatus('saved')
        onSaved(agentId, texto.trim())
        setTimeout(() => setStatus('idle'), 2500)
      } else {
        setStatus('idle')
      }
    } catch {
      setStatus('idle')
    }
  }

  async function limpiar() {
    setStatus('clearing')
    try {
      const res = await fetch('/api/settings-2/bot/agentes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruccion_agente: { id: agentId, texto: '' } }),
      })
      if (res.ok) {
        setTexto('')
        setStatus('idle')
        onSaved(agentId, '')
      } else {
        setStatus('idle')
      }
    } catch {
      setStatus('idle')
    }
  }

  return (
    <div className={cn('border-t border-zinc-100', !agentOn && 'opacity-50 pointer-events-none')}>
      {/* Botón toggle de la sección */}
      <button
        type="button"
        onClick={() => {
          setExpanded(!expanded)
          if (!expanded) setTimeout(() => textareaRef.current?.focus(), 50)
        }}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-zinc-50 transition-colors group"
      >
        <StickyNote className="w-3.5 h-3.5 text-zinc-400 group-hover:text-violet-500 transition-colors flex-shrink-0" />
        <span className="text-[11.5px] font-medium text-zinc-500 group-hover:text-zinc-700 flex-1">
          Instrucciones especiales
        </span>
        {hasValue && !expanded && (
          <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" title="Tiene instrucción configurada" />
        )}
        <ChevronRight className={cn(
          'w-3.5 h-3.5 text-zinc-400 transition-transform duration-150',
          expanded && 'rotate-90'
        )} />
      </button>

      {/* Cuerpo expandible */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2.5 bg-violet-50/30">
          <p className="text-[11px] text-zinc-500 pt-1 leading-relaxed">
            Escribe en lenguaje normal cómo debe comportarse el bot cuando usa el agente de{' '}
            <span className="font-semibold text-zinc-700">{agentLabel}</span>.
            Se inyecta directamente en el prompt solo cuando este agente está activo.
          </p>

          {/* Textarea */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, MAX))}
              placeholder={PLACEHOLDERS[agentId] ?? `Ej: Instrucciones específicas para el agente de ${agentLabel}...`}
              rows={4}
              className={cn(
                'w-full px-3 py-2.5 text-[12px] border rounded-lg resize-none transition-all',
                'focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent',
                'placeholder:text-zinc-300 text-zinc-800',
                isDirty
                  ? 'border-violet-300 bg-white'
                  : 'border-zinc-200 bg-white'
              )}
            />
            {/* Contador de caracteres */}
            <span className={cn(
              'absolute bottom-2 right-3 text-[10px] font-mono transition-colors',
              texto.length > MAX * 0.9 ? 'text-amber-500' : 'text-zinc-300'
            )}>
              {texto.length}/{MAX}
            </span>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center gap-2">
            <button
              onClick={guardar}
              disabled={!isDirty || status === 'saving' || texto.length > MAX}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all',
                status === 'saved'
                  ? 'bg-emerald-500 text-white'
                  : isDirty
                    ? 'bg-violet-600 hover:bg-violet-700 text-white'
                    : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
              )}
            >
              {status === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}
              {status === 'saved'  && <Check className="w-3 h-3" />}
              {status === 'saved' ? 'Guardado' : 'Guardar instrucción'}
            </button>

            {hasValue && (
              <button
                onClick={limpiar}
                disabled={status === 'clearing'}
                className="px-3 py-1.5 rounded-lg text-[11.5px] font-medium text-zinc-500 hover:text-rose-600 hover:bg-rose-50 transition-all border border-zinc-200"
              >
                {status === 'clearing' ? 'Borrando...' : 'Borrar instrucción'}
              </button>
            )}

            {isDirty && status !== 'saved' && (
              <span className="text-[10.5px] text-violet-500 ml-auto">Cambios sin guardar</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function BotAgentesTab() {
  const [data,                     setData]                     = useState<ApiData | null>(null)
  const [agentes,                  setAgentes]                  = useState<string[]>([])
  const [herramientasDesactivadas, setHerramientasDesactivadas] = useState<string[]>([])
  const [instrucciones,            setInstrucciones]            = useState<Record<string, string>>({})
  const [expanded,                 setExpanded]                 = useState<string | null>(null)
  const [isSaving,                 setIsSaving]                 = useState(false)
  const [savedOk,                  setSavedOk]                  = useState(false)

  useEffect(() => {
    fetch('/api/settings-2/bot/agentes')
      .then((r) => r.json())
      .then((d: ApiData) => {
        setData(d)
        setAgentes(d.agentes?.length ? d.agentes : (d.registry ?? []).map((a) => a.id))
        setHerramientasDesactivadas(d.herramientas_desactivadas ?? [])
        setInstrucciones(d.instrucciones_agentes ?? {})
      })
  }, [])

  function toggleAgent(id: string) {
    setAgentes((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    )
  }

  function toggleTool(toolName: string) {
    setHerramientasDesactivadas((prev) =>
      prev.includes(toolName) ? prev.filter((t) => t !== toolName) : [...prev, toolName]
    )
  }

  function handleInstruccionSaved(agentId: string, texto: string) {
    setInstrucciones((prev) => {
      const next = { ...prev }
      if (texto.trim() === '') delete next[agentId]
      else next[agentId] = texto.trim()
      return next
    })
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      await fetch('/api/settings-2/bot/agentes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentes,
          herramientas_desactivadas: herramientasDesactivadas,
        }),
      })
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2500)
    } finally {
      setIsSaving(false)
    }
  }

  if (!data) {
    return <div className="text-sm text-zinc-500 py-8 text-center">Cargando agentes...</div>
  }

  const totalConInstruccion = Object.keys(instrucciones).length

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="space-y-1">
        <p className="text-xs text-zinc-500">
          Activa o desactiva agentes completos, ajusta sus herramientas individualmente, y escribe
          instrucciones específicas en lenguaje natural para cada agente.
        </p>
        {totalConInstruccion > 0 && (
          <p className="text-[11px] text-violet-600 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />
            {totalConInstruccion} agente{totalConInstruccion > 1 ? 's' : ''} con instrucciones personalizadas activas
          </p>
        )}
      </div>

      {/* ── Herramientas núcleo ──────────────────────────────────────────────── */}
      <div className="border border-zinc-100 rounded-xl p-4 bg-zinc-50">
        <div className="flex items-center gap-2 mb-2.5">
          <Wrench className="w-3.5 h-3.5 text-zinc-400" />
          <p className="text-xs font-semibold text-zinc-500">Herramientas núcleo — siempre activas</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {data.core_tools.map((t) => (
            <span
              key={t.name}
              title={t.desc}
              className="text-[11px] bg-white border border-zinc-200 text-zinc-500 px-2 py-0.5 rounded-full cursor-default"
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Acordeón de agentes ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        {data.registry.map((agent) => {
          const agentOn      = agentes.includes(agent.id)
          const isOpen       = expanded === agent.id
          const toolsOn      = agent.tools.filter((t) => !herramientasDesactivadas.includes(t.name)).length
          const toolsTotal   = agent.tools.length
          const hasInstruc   = !!instrucciones[agent.id]

          return (
            <div
              key={agent.id}
              className={cn(
                'border rounded-xl overflow-hidden transition-colors',
                agentOn ? 'border-zinc-200' : 'border-zinc-100 bg-zinc-50/50'
              )}
            >
              {/* ── Fila del agente ────────────────────────────────────────── */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                {/* Toggle agente */}
                <button
                  onClick={() => toggleAgent(agent.id)}
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none',
                    agentOn ? 'bg-emerald-500' : 'bg-zinc-300'
                  )}
                  role="switch"
                  aria-checked={agentOn}
                >
                  <span className={cn(
                    'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                    agentOn ? 'translate-x-4' : 'translate-x-0'
                  )} />
                </button>

                {/* Dot de color */}
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: agentOn ? agent.accent : '#d1d5db' }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn('text-sm font-semibold', agentOn ? 'text-zinc-900' : 'text-zinc-400')}>
                      {agent.label}
                    </p>
                    {/* Indicador de instrucción configurada */}
                    {hasInstruc && (
                      <span
                        className="w-2 h-2 rounded-full bg-violet-400 shrink-0"
                        title="Tiene instrucciones especiales configuradas"
                      />
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">{agent.desc}</p>
                </div>

                {/* Contador de herramientas activas */}
                <span className={cn(
                  'text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0',
                  agentOn
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-zinc-100 text-zinc-400'
                )}>
                  {agentOn ? toolsOn : 0}/{toolsTotal} tools
                </span>

                {/* Chevron */}
                <button
                  onClick={() => setExpanded(isOpen ? null : agent.id)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 rounded transition shrink-0"
                  aria-label={isOpen ? 'Colapsar' : 'Expandir'}
                >
                  {isOpen
                    ? <ChevronDown className="w-4 h-4" />
                    : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>

              {/* ── Cuerpo expandible ──────────────────────────────────────── */}
              {isOpen && (
                <div className="divide-y divide-zinc-100">

                  {/* Herramientas */}
                  <div className="bg-slate-50/70 divide-y divide-zinc-100">
                    {agent.tools.map((tool) => {
                      const agentOff   = !agentOn
                      const toolOff    = herramientasDesactivadas.includes(tool.name)
                      const toolActive = agentOn && !toolOff
                      const hasIntegr  = !!tool.requiereIntegracion

                      return (
                        <div
                          key={tool.name}
                          className={cn(
                            'flex items-center gap-3 pl-12 pr-4 py-2.5',
                            agentOff && 'opacity-40'
                          )}
                        >
                          {/* Toggle herramienta */}
                          <button
                            onClick={() => !agentOff && toggleTool(tool.name)}
                            disabled={agentOff}
                            className={cn(
                              'relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none',
                              toolActive ? 'bg-indigo-500' : 'bg-zinc-300',
                              agentOff ? 'cursor-not-allowed' : 'cursor-pointer'
                            )}
                            role="switch"
                            aria-checked={toolActive}
                            title={agentOff ? 'Activa el agente primero' : toolOff ? 'Herramienta desactivada' : 'Herramienta activa'}
                          >
                            <span className={cn(
                              'inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform',
                              toolActive ? 'translate-x-3' : 'translate-x-0'
                            )} />
                          </button>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-zinc-800">{tool.label}</p>
                            <p className="text-[11px] text-zinc-400 truncate">{tool.desc}</p>
                          </div>

                          {/* Badge integración requerida */}
                          {hasIntegr && (
                            <a
                              href={`/dashboard/settings-2/integraciones/${tool.requiereIntegracion}`}
                              className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full hover:bg-amber-100 transition shrink-0"
                              title={`Requiere integración: ${tool.requiereIntegracion}`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {tool.requiereIntegracion}
                              <ExternalLink className="w-2 h-2" />
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* ── Instrucciones especiales del agente ──────────────── */}
                  <AgentInstruccion
                    agentId={agent.id}
                    agentLabel={agent.label}
                    agentOn={agentOn}
                    initialValue={instrucciones[agent.id] ?? ''}
                    onSaved={handleInstruccionSaved}
                  />

                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Botón guardar (toggles) ──────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            'w-full px-4 py-3 text-sm font-semibold text-white rounded-xl transition',
            savedOk
              ? 'bg-emerald-600'
              : isSaving
                ? 'bg-zinc-300 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
          )}
        >
          {isSaving ? '⏳ Guardando...' : savedOk ? '✓ Configuración guardada' : 'Guardar configuración'}
        </button>
        <p className="text-[10.5px] text-zinc-400 text-center">
          Guarda los toggles de agentes y herramientas. Las instrucciones se guardan individualmente.
        </p>
      </div>
    </div>
  )
}
