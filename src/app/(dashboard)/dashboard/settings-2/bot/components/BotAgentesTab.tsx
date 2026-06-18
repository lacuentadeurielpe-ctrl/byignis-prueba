'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, ExternalLink, Wrench } from 'lucide-react'
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
  registry:                  AgentDef[]
  core_tools:                ToolDef[]
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function BotAgentesTab() {
  const [data,                    setData]                    = useState<ApiData | null>(null)
  const [agentes,                 setAgentes]                 = useState<string[]>([])
  const [herramientasDesactivadas, setHerramientasDesactivadas] = useState<string[]>([])
  const [expanded,                setExpanded]                = useState<string | null>(null)
  const [isSaving,                setIsSaving]                = useState(false)
  const [savedOk,                 setSavedOk]                 = useState(false)

  useEffect(() => {
    fetch('/api/settings-2/bot/agentes')
      .then((r) => r.json())
      .then((d: ApiData) => {
        setData(d)
        // Si agentes está vacío → todos activos por defecto
        setAgentes(d.agentes?.length ? d.agentes : (d.registry ?? []).map((a) => a.id))
        setHerramientasDesactivadas(d.herramientas_desactivadas ?? [])
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

  return (
    <div className="space-y-5 max-w-2xl">
      <p className="text-xs text-zinc-500">
        Activa o desactiva agentes completos, o ajusta sus herramientas individualmente.
        Las herramientas núcleo siempre están disponibles.
      </p>

      {/* ── Herramientas núcleo ─────────────────────────────────────────── */}
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

      {/* ── Acordeón de agentes ─────────────────────────────────────────── */}
      <div className="space-y-2">
        {data.registry.map((agent) => {
          const agentOn  = agentes.includes(agent.id)
          const isOpen   = expanded === agent.id
          const toolsOn  = agent.tools.filter((t) => !herramientasDesactivadas.includes(t.name)).length
          const toolsTotal = agent.tools.length

          return (
            <div
              key={agent.id}
              className={cn(
                'border rounded-xl overflow-hidden transition-colors',
                agentOn ? 'border-zinc-200' : 'border-zinc-100 bg-zinc-50/50'
              )}
            >
              {/* Fila del agente */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                {/* Toggle agente (grande) */}
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

                {/* Dot de color del agente */}
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: agentOn ? agent.accent : '#d1d5db' }}
                />

                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-semibold', agentOn ? 'text-zinc-900' : 'text-zinc-400')}>
                    {agent.label}
                  </p>
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

                {/* Chevron para expandir */}
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

              {/* Cuerpo desplegable: herramientas */}
              {isOpen && (
                <div className="border-t border-zinc-100 bg-slate-50/70 divide-y divide-zinc-100">
                  {agent.tools.map((tool) => {
                    const agentOff    = !agentOn
                    const toolOff     = herramientasDesactivadas.includes(tool.name)
                    const toolActive  = agentOn && !toolOff
                    const hasIntegr   = !!tool.requiereIntegracion

                    return (
                      <div
                        key={tool.name}
                        className={cn(
                          'flex items-center gap-3 pl-12 pr-4 py-2.5',
                          agentOff && 'opacity-40'
                        )}
                      >
                        {/* Toggle herramienta (más pequeño, color índigo) */}
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

                        {/* Badge de integración requerida */}
                        {hasIntegr && (
                          <a
                            href={`/dashboard/settings-2/integraciones/${tool.requiereIntegracion}`}
                            className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full hover:bg-amber-100 transition shrink-0"
                            title={`Requiere integración conectada: ${tool.requiereIntegracion}`}
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
              )}
            </div>
          )
        })}
      </div>

      {/* ── Botón guardar ───────────────────────────────────────────────── */}
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
        {isSaving ? '⏳ Guardando...' : savedOk ? '✓ Guardado' : 'Guardar configuración'}
      </button>
    </div>
  )
}
