'use client'

import { formatFecha } from '@/lib/utils'
import { Bot, User, ShieldAlert } from 'lucide-react'

interface Mensaje {
  id: string
  role: 'cliente' | 'bot' | 'dueno'
  contenido: string
  created_at: string
}

interface Conversacion {
  id: string
  estado: string
  bot_pausado: boolean
  ultima_actividad: string
  mensajes?: Mensaje[]
}

interface Props {
  conversacion: Conversacion | null
}

export default function TabConversacion({ conversacion }: Props) {
  if (!conversacion) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center">
        <p className="text-sm text-zinc-500">Este cliente no ha interactuado con el bot de WhatsApp aún.</p>
      </div>
    )
  }

  const mensajes = conversacion.mensajes || []

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col" style={{ height: '600px' }}>
      {/* Header Chat */}
      <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">Historial de WhatsApp</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Última actividad: {formatFecha(conversacion.ultima_actividad)}</p>
        </div>
        <div className="flex gap-2">
          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            conversacion.estado === 'activa' ? 'bg-emerald-100 text-emerald-700' :
            conversacion.estado === 'intervenida_dueno' ? 'bg-amber-100 text-amber-700' :
            'bg-zinc-200 text-zinc-600'
          }`}>
            {conversacion.estado === 'intervenida_dueno' ? 'Atendido por Dueño' : conversacion.estado}
          </span>
          {conversacion.bot_pausado && (
            <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Bot Pausado
            </span>
          )}
        </div>
      </div>

      {/* Messages Window */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/50 flex flex-col-reverse">
        {mensajes.length === 0 ? (
          <p className="text-center text-zinc-400 text-sm my-auto">No hay mensajes guardados en el historial</p>
        ) : (
          mensajes.map((msg, i) => {
            const isCliente = msg.role === 'cliente'
            return (
              <div key={msg.id || i} className={`flex ${isCliente ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 max-w-[80%] ${isCliente ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                    isCliente ? 'bg-indigo-100 text-indigo-600' : 
                    msg.role === 'bot' ? 'bg-emerald-100 text-emerald-600' : 
                    'bg-amber-100 text-amber-600'
                  }`}>
                    {isCliente ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  
                  {/* Burbuja */}
                  <div className={`px-4 py-2.5 rounded-2xl ${
                    isCliente 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : msg.role === 'bot'
                        ? 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-none shadow-sm'
                        : 'bg-amber-50 border border-amber-200 text-zinc-800 rounded-tl-none shadow-sm'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.contenido}</p>
                    <p className={`text-[10px] mt-1 text-right ${isCliente ? 'text-indigo-200' : 'text-zinc-400'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
