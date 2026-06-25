'use client'

import { useState } from 'react'
import { Eye, History, CheckCircle2, XCircle, Info, X, ChevronDown } from 'lucide-react'
import type { ChatMessage } from './useAsistente'
import { AGENT_REGISTRY } from '@/lib/ai/agents/registry'

interface Props {
  messages: ChatMessage[]
}

// ── Descripciones legibles por herramienta ────────────────────────────────────

function describeAction(tool: string, args: Record<string, unknown>): string {
  switch (tool) {
    case 'toggle_agente': {
      const agent = AGENT_REGISTRY.find(a => a.id === args.agente_id)
      return `Agente "${agent?.label ?? args.agente_id}" ${args.activo ? 'activado' : 'desactivado'}`
    }
    case 'toggle_tool':
      return `Herramienta "${args.tool_name}" ${args.activo ? 'activada' : 'desactivada'}`
    case 'editar_instrucciones_globales':
      return (args.texto as string)?.trim()
        ? 'Instrucciones globales actualizadas'
        : 'Instrucciones globales borradas'
    case 'editar_instruccion_agente': {
      const agent = AGENT_REGISTRY.find(a => a.id === args.agente_id)
      return `Instrucción de "${agent?.label ?? args.agente_id}" ${(args.texto as string)?.trim() ? 'actualizada' : 'borrada'}`
    }
    case 'editar_nota_tool':
      return `Nota de "${args.tool_name}" ${(args.texto as string)?.trim() ? 'actualizada' : 'borrada'}`
    case 'editar_recordatorios_deuda':
      return `Recordatorios de deuda ${args.activo ? 'activados' : 'desactivados'}`
    case 'guardar_memoria':
      return `Memoria guardada: "${String(args.texto ?? '').slice(0, 40)}${String(args.texto ?? '').length > 40 ? '…' : ''}"`
    case 'borrar_memoria':
      return `Memoria #${args.indice} borrada`
    case 'leer_config_actual':
      return 'Configuración consultada'
    case 'leer_logs_bot':
      return 'Logs del bot consultados'
    default:
      return tool
  }
}

const READ_ONLY_TOOLS = new Set(['leer_config_actual', 'leer_logs_bot'])

// ── Preview modal ─────────────────────────────────────────────────────────────

interface PreviewData {
  secciones:             { key: string; label: string; avanzado: boolean; texto: string; esDefault: boolean }[]
  instrucciones_extra:   string
  instrucciones_agentes: Record<string, string>
  instrucciones_tools:   Record<string, string>
  agentes_activos:       string[]
  vars:                  Record<string, string>
}

function PromptPreviewModal({ data, loading, onClose }: {
  data:    unknown
  loading: boolean
  onClose: () => void
}) {
  const d = data as PreviewData | null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Estructura del prompt</h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Cómo se construye el prompt que lee el bot de WhatsApp, capa por capa
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 rounded-lg transition">
            <X size={14} className="text-zinc-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <p className="text-sm text-zinc-400 animate-pulse">Cargando estructura…</p>
          </div>
        ) : d ? (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* Variables del negocio */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide mb-2">
                Variables del negocio (resueltas en tiempo real)
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {d.vars && Object.entries(d.vars).map(([k, v]) => (
                  <div key={k} className="flex items-start gap-1.5 text-[11px]">
                    <code className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono shrink-0">
                      {'{' + k + '}'}
                    </code>
                    <span className="text-blue-800 truncate">{String(v) || '(vacío)'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Capa 1 */}
            <CapaSection
              badge="Capa 1"
              badgeColor="violet"
              title="Prompt principal del orquestador"
              subtitle="Reglas base del bot — siempre presentes"
            >
              <div className="space-y-1.5">
                {d.secciones.filter(s => s.key !== 'verificacion_pagos').map(s => (
                  <details key={s.key} className="border border-zinc-200 rounded-lg overflow-hidden group">
                    <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-50 text-[11.5px] font-medium text-zinc-700 list-none">
                      <ChevronDown size={12} className="text-zinc-400 group-open:rotate-180 transition-transform shrink-0" />
                      {!s.esDefault && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />}
                      <span className="flex-1">{s.label}</span>
                      <span className="text-[10px] text-zinc-400">{s.texto.length} chars</span>
                      {!s.esDefault && <span className="text-[10px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">personalizado</span>}
                      {s.avanzado && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">avanzado</span>}
                    </summary>
                    <div className="border-t border-zinc-100 px-3 py-2 bg-zinc-50">
                      <pre className="text-[10.5px] text-zinc-600 font-mono whitespace-pre-wrap leading-relaxed">
                        {s.texto}
                      </pre>
                    </div>
                  </details>
                ))}
              </div>
            </CapaSection>

            {/* Capa 2 */}
            <CapaSection
              badge="Capa 2"
              badgeColor="indigo"
              title="Instrucciones globales extra"
              subtitle="Inyectadas en TODOS los contextos, al inicio del prompt"
            >
              <div className={`border rounded-lg px-3 py-2.5 text-[11px] ${
                d.instrucciones_extra
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-800 whitespace-pre-wrap'
                  : 'border-zinc-100 bg-zinc-50 text-zinc-400 italic'
              }`}>
                {d.instrucciones_extra || 'Sin instrucciones globales extra configuradas'}
              </div>
            </CapaSection>

            {/* Capa 3 */}
            <CapaSection
              badge="Capa 3"
              badgeColor="emerald"
              title="Instrucciones por agente"
              subtitle="Se inyectan solo cuando ese agente está activo"
            >
              <div className="space-y-1.5">
                {AGENT_REGISTRY.map(agent => {
                  const activo     = d.agentes_activos?.includes(agent.id) ?? true
                  const instruccion = d.instrucciones_agentes?.[agent.id]
                  if (!activo && !instruccion) return null
                  return (
                    <div
                      key={agent.id}
                      className={`border rounded-lg px-3 py-2 text-[11px] ${
                        instruccion ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-100 bg-zinc-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: activo ? agent.accent : '#d1d5db' }} />
                        <span className="font-medium text-zinc-700">{agent.label}</span>
                        {!activo && <span className="text-zinc-400 text-[10px]">(desactivado)</span>}
                      </div>
                      {instruccion
                        ? <p className="text-zinc-700 pl-3 whitespace-pre-wrap">{instruccion}</p>
                        : <p className="text-zinc-400 italic pl-3">Sin instrucción especial</p>}
                    </div>
                  )
                })}
              </div>
            </CapaSection>

            {/* Capa 4 */}
            <CapaSection
              badge="Capa 4"
              badgeColor="amber"
              title="Notas por herramienta"
              subtitle="El bot las lee justo antes de usar cada herramienta"
            >
              {d.instrucciones_tools && Object.keys(d.instrucciones_tools).length > 0 ? (
                <div className="space-y-1.5">
                  {Object.entries(d.instrucciones_tools).map(([name, nota]) => (
                    <div key={name} className="border border-amber-200 bg-amber-50 rounded-lg px-3 py-2 text-[11px]">
                      <code className="text-amber-700 font-mono block mb-0.5">{name}</code>
                      <p className="text-zinc-700">{nota}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-zinc-400 italic px-1">Sin notas por herramienta</p>
              )}
            </CapaSection>

            {/* Especial: verificacion_pagos */}
            <CapaSection
              badge="Especial"
              badgeColor="zinc"
              title="Verificación de pagos"
              subtitle="Solo para análisis de imágenes de comprobantes — no va al orquestador"
            >
              <pre className="text-[10.5px] text-zinc-500 font-mono whitespace-pre-wrap bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2">
                {d.secciones.find(s => s.key === 'verificacion_pagos')?.texto ?? '(sin configurar)'}
              </pre>
            </CapaSection>

          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center py-16">
            <p className="text-sm text-red-500">Error al cargar el prompt</p>
          </div>
        )}
      </div>
    </div>
  )
}

const BADGE_COLORS: Record<string, string> = {
  violet: 'bg-violet-100 text-violet-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  zinc: 'bg-zinc-100 text-zinc-600',
}

function CapaSection({
  badge, badgeColor, title, subtitle, children,
}: {
  badge: string; badgeColor: string; title: string; subtitle: string; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${BADGE_COLORS[badgeColor] ?? BADGE_COLORS.zinc}`}>
          {badge}
        </span>
        <div>
          <p className="text-[11.5px] font-semibold text-zinc-700 leading-none">{title}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

// ── Panel principal ───────────────────────────────────────────────────────────

export default function SessionSummaryPanel({ messages }: Props) {
  const [previewOpen,    setPreviewOpen]    = useState(false)
  const [previewData,    setPreviewData]    = useState<unknown>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Extraer acciones de todos los mensajes del asistente
  const allActions = messages
    .filter(m => m.role === 'assistant')
    .flatMap(m => (m.tools ?? []).filter(t => t.done))

  const changes  = allActions.filter(a => !READ_ONLY_TOOLS.has(a.tool))
  const readings = allActions.filter(a => READ_ONLY_TOOLS.has(a.tool))

  async function openPreview() {
    setPreviewOpen(true)
    if (previewData) return
    setLoadingPreview(true)
    try {
      const res = await fetch('/api/settings-2/bot/prompt')
      if (res.ok) setPreviewData(await res.json())
    } finally {
      setLoadingPreview(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 shrink-0 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Resumen de sesión</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">
            {changes.length > 0
              ? `${changes.length} cambio${changes.length !== 1 ? 's' : ''} aplicado${changes.length !== 1 ? 's' : ''}`
              : 'Sin cambios aún'}
          </p>
        </div>
        <button
          onClick={openPreview}
          className="flex items-center gap-1.5 text-[11px] font-medium text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-2.5 py-1.5 rounded-lg border border-violet-200 transition"
        >
          <Eye size={12} />
          Ver prompt
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 min-h-0">
        {allActions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <History size={24} className="text-zinc-200" />
            <p className="text-xs text-zinc-400 leading-relaxed">
              Aquí verás qué cambió en esta sesión — agentes encendidos, instrucciones editadas, memorias guardadas, etc.
            </p>
            <button
              onClick={openPreview}
              className="text-[11px] text-violet-600 hover:underline flex items-center gap-1"
            >
              <Eye size={11} />
              Ver cómo está construido el prompt ahora
            </button>
          </div>
        ) : (
          <>
            {changes.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide px-1 pb-0.5">
                  Cambios aplicados
                </p>
                {changes.map((action, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-lg px-2.5 py-2 border text-[11px] ${
                      action.ok !== false
                        ? 'bg-white border-zinc-200 text-zinc-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    <span className="shrink-0 mt-0.5">
                      {action.ok !== false
                        ? <CheckCircle2 size={12} className="text-green-500" />
                        : <XCircle size={12} className="text-red-400" />}
                    </span>
                    <span className="flex-1 leading-snug">{describeAction(action.tool, action.args)}</span>
                  </div>
                ))}
              </div>
            )}

            {readings.length > 0 && (
              <div className="space-y-1 mt-3">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide px-1 pb-0.5">
                  Consultas
                </p>
                {readings.map((action, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-zinc-400 px-2.5 py-1.5">
                    <Info size={10} className="shrink-0" />
                    <span>{describeAction(action.tool, action.args)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {previewOpen && (
        <PromptPreviewModal
          data={previewData}
          loading={loadingPreview}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  )
}
