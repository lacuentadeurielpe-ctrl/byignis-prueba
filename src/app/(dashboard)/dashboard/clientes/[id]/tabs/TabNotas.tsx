'use client'

import { useState } from 'react'
import { FileText, Phone, Users, MessageCircle, Loader2, Send, Trash2 } from 'lucide-react'
import { formatFecha } from '@/lib/utils'

interface NotaCRM {
  id: string
  tipo: 'nota' | 'llamada' | 'reunion' | 'whatsapp'
  contenido: string
  created_at: string
  autor_id: string
}

interface Props {
  clienteId: string
  notasCRM: NotaCRM[]
  userId: string
  esDueno: boolean
}

export default function TabNotas({ clienteId, notasCRM: iniciales, userId, esDueno }: Props) {
  const [notas, setNotas] = useState<NotaCRM[]>(iniciales)
  const [nuevaNota, setNuevaNota] = useState('')
  const [tipoNota, setTipoNota] = useState<NotaCRM['tipo']>('nota')
  const [enviando, setEnviando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)

  const TIPO_ICONS = {
    nota: { icon: FileText, color: 'text-amber-500', bg: 'bg-amber-100', label: 'Nota' },
    llamada: { icon: Phone, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Llamada' },
    reunion: { icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-100', label: 'Reunión' },
    whatsapp: { icon: MessageCircle, color: 'text-emerald-500', bg: 'bg-emerald-100', label: 'WhatsApp' },
  }

  async function eliminarNota(notaId: string) {
    if (!confirm('¿Eliminar esta nota?')) return
    setEliminandoId(notaId)
    try {
      await fetch(`/api/clientes/${clienteId}/notas/${notaId}`, { method: 'DELETE' })
      setNotas(prev => prev.filter(n => n.id !== notaId))
    } finally {
      setEliminandoId(null)
    }
  }

  async function agregarNota() {
    if (!nuevaNota.trim()) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/clientes/${clienteId}/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: nuevaNota.trim(), tipo: tipoNota })
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setNotas([{ ...data, autor_id: userId }, ...notas])
      setNuevaNota('')
      setTipoNota('nota')
    } catch {
      alert('Error al guardar nota')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Editor (1 col) */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden sticky top-6">
          <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
            <h3 className="text-sm font-bold text-zinc-900">Registrar Interacción</h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              {Object.entries(TIPO_ICONS).map(([key, config]) => {
                const Icon = config.icon
                const isActive = tipoNota === key
                return (
                  <button
                    key={key}
                    onClick={() => setTipoNota(key as any)}
                    className={`flex-1 flex flex-col items-center justify-center p-2 rounded-xl transition ${
                      isActive ? 'bg-zinc-900 text-white shadow-md' : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1 ${isActive ? 'text-white' : config.color}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{config.label}</span>
                  </button>
                )
              })}
            </div>

            <textarea
              value={nuevaNota}
              onChange={(e) => setNuevaNota(e.target.value)}
              placeholder="¿Qué sucedió con este cliente?"
              className="w-full h-32 px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none bg-zinc-50"
            />

            <button
              onClick={agregarNota}
              disabled={enviando || !nuevaNota.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {enviando ? 'Guardando...' : 'Guardar en Historial'}
            </button>
          </div>
        </div>
      </div>

      {/* Feed (2 cols) */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden p-6">
          <h3 className="text-lg font-bold text-zinc-900 mb-6">Bitácora CRM</h3>
          
          {notas.length === 0 ? (
            <div className="text-center py-12 bg-zinc-50 rounded-xl border border-zinc-100 border-dashed">
              <FileText className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-zinc-500">No hay interacciones registradas.</p>
            </div>
          ) : (
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-200 before:to-transparent">
              {notas.map((nota, i) => {
                const config = TIPO_ICONS[nota.tipo] || TIPO_ICONS.nota
                const Icon = config.icon
                const esMio = nota.autor_id === userId

                return (
                  <div key={nota.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    {/* Icon */}
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white ${config.bg} shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    {/* Card */}
                    <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-zinc-200 bg-white shadow-sm hover:shadow-md transition">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                        <time className="text-xs font-medium text-zinc-400">{formatFecha(nota.created_at)}</time>
                      </div>
                      <p className="text-sm text-zinc-700 whitespace-pre-wrap">{nota.contenido}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-zinc-400 font-medium">
                          Registrado por: <span className="text-zinc-600">{esMio ? 'Tú' : 'Usuario'}</span>
                        </span>
                        {(esMio || esDueno) && (
                          <button
                            onClick={() => eliminarNota(nota.id)}
                            disabled={eliminandoId === nota.id}
                            className="p-1 text-zinc-300 hover:text-rose-500 transition rounded"
                            title="Eliminar nota"
                          >
                            {eliminandoId === nota.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
