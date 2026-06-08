// Historial completo de un cliente (CRM Profile)
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { redirect, notFound } from 'next/navigation'
import ClienteDetalleView from './ClienteDetalleView'
import { ClientesRepository } from '@/lib/db/repositories/clientes'
import { ChatRepository } from '@/lib/db/repositories/chat'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ClienteDetallePage({ params }: Props) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()
  const clientesRepo = new ClientesRepository(supabase)
  const chatRepo = new ChatRepository(supabase)

  // 1. Datos del cliente (retorna null si falla o no pertenece a la ferretería)
  let cliente: any = null
  try {
    cliente = await clientesRepo.obtenerDetalleCliente(session.ferreteriaId, id)
  } catch {
    cliente = null
  }

  if (!cliente) notFound()

  // 2. Cargar en paralelo pedidos, cotizaciones, créditos, conversación activa y datos CRM
  const [pedidos, cotizaciones, creditos, conversacion, oportunidades, notas] = await Promise.all([
    clientesRepo.obtenerPedidosDeCliente(session.ferreteriaId, id),
    clientesRepo.obtenerCotizacionesDeCliente(session.ferreteriaId, id),
    clientesRepo.obtenerCreditosDeCliente(session.ferreteriaId, id),
    chatRepo.obtenerConversacionReciente(session.ferreteriaId, id),
    clientesRepo.obtenerOportunidadesDeCliente(session.ferreteriaId, id).catch(() => []),
    clientesRepo.obtenerNotasDeCliente(session.ferreteriaId, id).catch(() => []),
  ])

  // Cargar últimos mensajes si hay conversación
  let mensajes: any[] = []
  if (conversacion) {
    try {
      const msjs = await chatRepo.obtenerMensajesDeConversacion(conversacion.id, 30)
      mensajes = msjs || []
    } catch {
      mensajes = []
    }
  }

  return (
    <Suspense fallback={<div className="p-6">Cargando...</div>}>
      <ClienteDetalleView
        cliente={cliente}
        pedidos={pedidos || []}
        cotizaciones={cotizaciones || []}
        creditos={creditos || []}
        conversacion={conversacion ? { ...conversacion, mensajes } : null}
        oportunidades={oportunidades || []}
        notas={notas || []}
        esDueno={session.rol === 'dueno'}
        userId={session.userId}
      />
    </Suspense>
  )
}
