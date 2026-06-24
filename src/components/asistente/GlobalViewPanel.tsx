'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Eye, ToggleLeft, ToggleRight, Wrench, Settings2, MessageSquare } from 'lucide-react'
import type { AsistenteConfigSnapshot } from '@/lib/ai/asistente/context-builder'
import { AGENT_REGISTRY, CORE_TOOLS } from '@/lib/ai/agents/registry'
import type { PatchEvent } from './useAsistente'

interface Props {
  snapshot:      AsistenteConfigSnapshot | null
  recentPatches: PatchEvent[]
}

type PanelTab = 'agentes' | 'herramientas' | 'instrucciones' | 'config'

const PANEL_TABS: { id: PanelTab; label: string; icon: React.ComponentType<{ size: number; className?: string }> }[] = [
  { id: 'agentes',        label: 'Agentes',       icon: ToggleRight },
  { id: 'herramientas',   label: 'Herramientas',  icon: Wrench },
  { id: 'instrucciones',  label: 'Instrucciones', icon: MessageSquare },
  { id: 'config',         label: 'Config',        icon: Settings2 },
]

const HIGHLIGHT_TTL = 3000

export default function GlobalViewPanel({ snapshot, recentPatches }: Props) {
  const [tab,        setTab]        = useState<PanelTab>('agentes')
  const [highlights, setHighlights] = useState<Set<string>>(new Set())

  // Add highlights from patches and clear after TTL
  useEffect(() => {
    if (recentPatches.length === 0) return
    const last = recentPatches[recentPatches.length - 1]
    const key  = last.key ? `${last.target}.${last.key}` : last.target

    setHighlights(prev => new Set([...prev, key]))
    const t = setTimeout(() => {
      setHighlights(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }, HIGHLIGHT_TTL)
    return () => clearTimeout(t)
  }, [recentPatches])

  const isHighlighted = (key: string) => highlights.has(key)
  const hl = (key: string) =>
    isHighlighted(key) ? 'ring-2 ring-violet-400 bg-violet-50' : ''

  if (!snapshot) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 text-center px-6">
        <Eye size={24} className="text-zinc-300" />
        <p className="text-sm text-zinc-400">La vista global aparecerá cuando el asistente haga su primera acción.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 shrink-0">
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Vista Global en Vivo</p>
        <p className="text-[10px] text-zinc-400 mt-0.5">Se actualiza con cada acción del asistente</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 shrink-0">
        {PANEL_TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors border-b-2 ${
                tab === t.id
                  ? 'border-violet-600 text-violet-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <Icon size={11} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">

        {/* ── AGENTES ─────────────────────────────────────────────────────── */}
        {tab === 'agentes' && (
          <>
            {AGENT_REGISTRY.map(agent => {
              const activo = snapshot.agentes_activos.includes(agent.id)
              return (
                <div
                  key={agent.id}
                  className={`rounded-lg border px-3 py-2 transition-all duration-300 ${
                    activo ? 'border-zinc-200 bg-white' : 'border-zinc-100 bg-zinc-50'
                  } ${hl('agentes_activos')}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: agent.accent }}
                      />
                      <span className={`text-xs font-medium ${activo ? 'text-zinc-800' : 'text-zinc-400'}`}>
                        {agent.label}
                      </span>
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] font-medium ${activo ? 'text-green-600' : 'text-zinc-400'}`}>
                      {activo ? <CheckCircle size={10} /> : <XCircle size={10} />}
                      {activo ? 'activo' : 'desactivado'}
                    </div>
                  </div>
                  {snapshot.instrucciones_agentes[agent.id] && (
                    <div className={`mt-1.5 text-[10px] text-zinc-500 bg-zinc-50 rounded px-2 py-1 border border-zinc-100 transition-all duration-300 ${hl(`instrucciones_agentes.${agent.id}`)}`}>
                      <span className="text-zinc-400">instrucción: </span>
                      {snapshot.instrucciones_agentes[agent.id].slice(0, 100)}
                      {snapshot.instrucciones_agentes[agent.id].length > 100 && '…'}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* ── HERRAMIENTAS ────────────────────────────────────────────────── */}
        {tab === 'herramientas' && (
          <>
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide px-1">Núcleo (siempre activas)</div>
            {CORE_TOOLS.map(t => (
              <div key={t.name} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-1.5">
                <span className="text-[11px] font-mono text-zinc-600">{t.name}</span>
                <span className="text-[10px] text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">núcleo</span>
              </div>
            ))}

            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide px-1 mt-2">Herramientas de agentes</div>
            {AGENT_REGISTRY.flatMap(agent =>
              agent.tools.map(t => {
                const desact  = snapshot.herramientas_desactivadas.includes(t.name)
                const nota    = snapshot.instrucciones_tools[t.name]
                return (
                  <div
                    key={t.name}
                    className={`rounded-lg border px-3 py-1.5 transition-all duration-300 ${
                      desact ? 'border-zinc-100 bg-zinc-50 opacity-60' : 'border-zinc-200 bg-white'
                    } ${hl('herramientas_desactivadas')}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: agent.accent }} />
                        <span className="text-[11px] font-mono text-zinc-700">{t.name}</span>
                      </div>
                      {desact ? (
                        <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                          <ToggleLeft size={10} /> off
                        </span>
                      ) : (
                        <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                          <ToggleRight size={10} /> on
                        </span>
                      )}
                    </div>
                    {nota && (
                      <div className={`mt-1 text-[10px] text-violet-600 italic transition-all duration-300 ${hl(`instrucciones_tools.${t.name}`)}`}>
                        nota: {nota.slice(0, 80)}{nota.length > 80 && '…'}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </>
        )}

        {/* ── INSTRUCCIONES ───────────────────────────────────────────────── */}
        {tab === 'instrucciones' && (
          <>
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide px-1">Globales (Capa 1)</div>
            <div className={`rounded-lg border px-3 py-2 transition-all duration-300 ${hl('instrucciones_extra')} ${snapshot.instrucciones_extra ? 'border-violet-200 bg-violet-50' : 'border-zinc-100 bg-zinc-50'}`}>
              <p className="text-[10px] text-zinc-400 mb-0.5">instrucciones_extra</p>
              <p className="text-[11px] text-zinc-700 whitespace-pre-wrap">
                {snapshot.instrucciones_extra || <span className="text-zinc-400 italic">vacías</span>}
              </p>
            </div>

            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide px-1 mt-2">Por agente (Capa 2)</div>
            {AGENT_REGISTRY.map(agent => {
              const texto = snapshot.instrucciones_agentes[agent.id]
              if (!texto) return null
              return (
                <div key={agent.id} className={`rounded-lg border border-zinc-200 bg-white px-3 py-2 transition-all duration-300 ${hl(`instrucciones_agentes.${agent.id}`)}`}>
                  <p className="text-[10px] font-medium text-zinc-500 mb-0.5" style={{ color: agent.accent }}>{agent.label}</p>
                  <p className="text-[11px] text-zinc-700 whitespace-pre-wrap">{texto}</p>
                </div>
              )
            })}
            {Object.keys(snapshot.instrucciones_agentes).length === 0 && (
              <p className="text-[11px] text-zinc-400 italic px-1">Sin instrucciones por agente</p>
            )}

            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide px-1 mt-2">Por herramienta (Capa 3)</div>
            {Object.entries(snapshot.instrucciones_tools).map(([toolName, nota]) => (
              <div key={toolName} className={`rounded-lg border border-zinc-200 bg-white px-3 py-2 transition-all duration-300 ${hl(`instrucciones_tools.${toolName}`)}`}>
                <p className="text-[10px] font-mono text-violet-600 mb-0.5">{toolName}</p>
                <p className="text-[11px] text-zinc-700">{nota}</p>
              </div>
            ))}
            {Object.keys(snapshot.instrucciones_tools).length === 0 && (
              <p className="text-[11px] text-zinc-400 italic px-1">Sin notas por herramienta</p>
            )}
          </>
        )}

        {/* ── CONFIG ──────────────────────────────────────────────────────── */}
        {tab === 'config' && (
          <>
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide px-1">Recordatorios de deuda</div>
            <div className={`rounded-lg border px-3 py-2 transition-all duration-300 ${hl('config_recordatorios_deuda')} ${snapshot.config_recordatorios_deuda.activo ? 'border-orange-200 bg-orange-50' : 'border-zinc-100 bg-zinc-50'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-zinc-700">Recordatorios automáticos</span>
                <span className={`text-[10px] font-semibold ${snapshot.config_recordatorios_deuda.activo ? 'text-orange-600' : 'text-zinc-400'}`}>
                  {snapshot.config_recordatorios_deuda.activo ? 'ACTIVOS' : 'desactivados'}
                </span>
              </div>
              {snapshot.config_recordatorios_deuda.activo && (
                <div className="text-[10px] text-zinc-500 space-y-0.5">
                  <p>Días de gracia: {snapshot.config_recordatorios_deuda.dias_gracia}</p>
                  {snapshot.config_recordatorios_deuda.mensaje_custom && (
                    <p>Mensaje custom: {snapshot.config_recordatorios_deuda.mensaje_custom.slice(0, 60)}…</p>
                  )}
                </div>
              )}
            </div>

            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide px-1 mt-2">Memorias del asistente</div>
            {snapshot.memorias.length > 0 ? (
              snapshot.memorias.map((m, i) => (
                <div key={i} className={`rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] text-zinc-700 transition-all duration-300 ${hl('memorias')}`}>
                  <span className="text-zinc-400 mr-1">{i + 1}.</span>{m}
                </div>
              ))
            ) : (
              <p className="text-[11px] text-zinc-400 italic px-1">Sin memorias guardadas</p>
            )}

            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide px-1 mt-2">Secciones del prompt personalizadas</div>
            {Object.keys(snapshot.prompt_overrides).length > 0 ? (
              Object.entries(snapshot.prompt_overrides).map(([key, val]) => (
                <div key={key} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-mono text-zinc-500 mb-0.5">{key}</p>
                  <p className="text-[11px] text-zinc-700">{val.slice(0, 100)}{val.length > 100 && '…'}</p>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-zinc-400 italic px-1">Usando prompts predeterminados</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
