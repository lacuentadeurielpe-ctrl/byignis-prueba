import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ClientesRepository } from '@/lib/db/repositories/clientes'
import { ChatRepository } from '@/lib/db/repositories/chat'

export async function GET(req: Request) {
  const supabase = await createClient()
  const clientesRepo = new ClientesRepository(supabase)
  const chatRepo = new ChatRepository(supabase)

  const ferreteriaId = '32e14714-dfae-4a90-8cb9-41eb7d90a8d2'
  const id = 'c4a016c2-bcc4-4752-bd31-1e32b4c400da'

  try {
    const cliente = await clientesRepo.obtenerDetalleCliente(ferreteriaId, id)
    if (!cliente) return NextResponse.json({ error: 'no cliente' })

    const [pedidos, cotizaciones, creditos, conversacion, oportunidades, notas] = await Promise.all([
      clientesRepo.obtenerPedidosDeCliente(ferreteriaId, id),
      clientesRepo.obtenerCotizacionesDeCliente(ferreteriaId, id),
      clientesRepo.obtenerCreditosDeCliente(ferreteriaId, id),
      chatRepo.obtenerConversacionReciente(ferreteriaId, id),
      clientesRepo.obtenerOportunidadesDeCliente(ferreteriaId, id),
      clientesRepo.obtenerNotasDeCliente(ferreteriaId, id),
    ])

    return NextResponse.json({ 
      success: true, 
      cliente, pedidos, cotizaciones, creditos, conversacion, oportunidades, notas 
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, stack: error.stack })
  }
}
