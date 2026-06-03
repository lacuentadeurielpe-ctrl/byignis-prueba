// Vista de conversación activa
// Mobile:   pantalla completa con botón atrás
// Desktop:  lista (izq) + chat (centro) + panel contextual (der, xl+)
import { createClient }    from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ConversationsList   from '@/components/conversations/ConversationsList'
import ChatView            from '@/components/conversations/ChatView'
import ContextPanel        from '@/components/conversations/ContextPanel'
import { getSessionInfo }  from '@/lib/auth/roles'
import { ChatRepository }  from '@/lib/db/repositories/chat'
import { ClientesRepository } from '@/lib/db/repositories/clientes'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ConversationPage({ params }: Props) {
  const { id }  = await params
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()
  const chatRepo = new ChatRepository(supabase)
  const clientesRepo = new ClientesRepository(supabase)

  // Conversación activa
  let conversacion: any = null
  try {
    conversacion = await chatRepo.obtenerConversacionPorId(session.ferreteriaId, id)
  } catch {
    conversacion = null
  }

  if (!conversacion) notFound()

  // Mensajes (incluye tipo para mostrar indicador de audio)
  const mensajes = await chatRepo.obtenerMensajesDeConversacion(id)

  // Lista de conversaciones (panel izquierdo)
  const conversaciones = await chatRepo.obtenerConversacionesList(session.ferreteriaId)
  const convIds = (conversaciones ?? []).map(c => c.id)

  let ultimosMensajes: Record<string, { contenido: string; role: string }> = {}
  if (convIds.length > 0) {
    const msgs = await chatRepo.obtenerUltimosMensajesPorConversaciones(convIds)

    for (const m of msgs ?? []) {
      if (!ultimosMensajes[m.conversacion_id]) {
        ultimosMensajes[m.conversacion_id] = { contenido: m.contenido, role: m.role }
      }
    }
  }

  const enriquecidas = (conversaciones ?? []).map((conv) => {
    const ultimo   = ultimosMensajes[conv.id]
    const clientes = Array.isArray(conv.clientes) ? conv.clientes[0] ?? null : conv.clientes
    return {
      ...conv,
      clientes:       clientes as { nombre: string | null; telefono: string } | null,
      ultimo_mensaje: ultimo?.contenido ?? undefined,
      rol_ultimo:     ultimo?.role      ?? undefined,
    }
  })

  // Datos del cliente para el panel contextual
  const clienteRaw   = Array.isArray(conversacion.clientes)
    ? conversacion.clientes[0] ?? null
    : conversacion.clientes
  const cliente      = clienteRaw as { nombre: string | null; telefono: string } | null
  const clienteId    = (conversacion as Record<string, unknown>).cliente_id as string | null

  // Últimos pedidos del cliente para el panel CRM
  let pedidosCliente: any[] = []
  if (clienteId) {
    const allPedidos = await clientesRepo.obtenerPedidosDeCliente(session.ferreteriaId, clienteId)
    pedidosCliente = (allPedidos ?? []).slice(0, 4)
  }

  // Total de mensajes para stats
  const totalMensajes = await chatRepo.contarMensajesDeConversacion(id)

  return (
    <div className="absolute inset-0 flex overflow-hidden">

      {/* ── Panel izquierdo — lista (oculto en mobile) ────────────────────── */}
      <div className="hidden md:flex w-72 shrink-0 border-r border-zinc-100 bg-white flex-col">
        <ConversationsList inicial={enriquecidas} ferreteriaId={session.ferreteriaId} />
      </div>

      {/* ── Chat — pantalla completa en mobile ────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ChatView
          conversacion={{
            ...conversacion,
            clientes: cliente,
          }}
          mensajesIniciales={mensajes ?? []}
          ferreteriaId={session.ferreteriaId}
        />
      </div>

      {/* ── Panel contextual — solo xl+ ───────────────────────────────────── */}
      <ContextPanel
        conversacion={{
          id,
          bot_pausado: conversacion.bot_pausado,
          created_at: (conversacion as Record<string, unknown>).created_at as string,
        }}
        cliente={cliente}
        clienteId={clienteId}
        pedidos={pedidosCliente ?? []}
        totalMensajes={totalMensajes ?? 0}
      />

    </div>
  )
}
