import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionInfo } from '@/lib/auth/roles'
import { createAdminClient as createAdminForSender } from '@/lib/supabase/admin'
import { resolverSender } from '@/lib/whatsapp/provider'

type Params = { params: Promise<{ id: string }> }

// POST /api/campanas/[id]/enviar — inicia envío de la campaña
// Envía en batches de 20 con delay de 1s entre mensajes para respetar rate limits
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const admin    = createAdminClient()

  // Cargar campaña
  const { data: campana, error: ce } = await supabase
    .from('campanas')
    .select('*, plantillas_wa(*)')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (ce || !campana) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
  if (campana.estado === 'enviando') return NextResponse.json({ error: 'Ya está enviando' }, { status: 409 })
  if (campana.estado === 'completada') return NextResponse.json({ error: 'Ya completada' }, { status: 409 })

  // Marcar como enviando
  await admin.from('campanas').update({ estado: 'enviando', iniciada_at: new Date().toISOString() }).eq('id', id)

  // Obtener destinatarios según filtros
  let clientesQuery = admin
    .from('clientes')
    .select('id, telefono, nombre')
    .eq('ferreteria_id', session.ferreteriaId)
    .not('telefono', 'is', null)

  if (campana.acepta_mkt_only) clientesQuery = clientesQuery.eq('acepta_marketing', true)
  if (campana.filtro_tipo)     clientesQuery = clientesQuery.eq('tipo', campana.filtro_tipo)
  if (campana.filtro_tags?.length) clientesQuery = clientesQuery.overlaps('tags', campana.filtro_tags)

  const { data: clientes } = await clientesQuery.limit(5000)
  if (!clientes?.length) {
    await admin.from('campanas').update({ estado: 'completada', completada_at: new Date().toISOString() }).eq('id', id)
    return NextResponse.json({ ok: true, enviados: 0 })
  }

  // Insertar destinatarios (skip duplicados)
  await admin.from('campana_destinatarios').upsert(
    clientes.map(c => ({ campana_id: id, cliente_id: c.id, estado: 'pendiente' })),
    { onConflict: 'campana_id,cliente_id', ignoreDuplicates: true }
  )

  // Resolver sender WhatsApp
  const { data: ferreteria } = await admin
    .from('ferreterias').select('telefono_whatsapp').eq('id', session.ferreteriaId).single()

  const senderClient = createAdminForSender()
  const sender = await resolverSender(senderClient, session.ferreteriaId, ferreteria?.telefono_whatsapp ?? '')
  if (!sender) {
    await admin.from('campanas').update({ estado: 'cancelada' }).eq('id', id)
    return NextResponse.json({ error: 'Sin proveedor WhatsApp configurado' }, { status: 503 })
  }

  // Enviar en batches de 5 con delay de 2s (respetar rate limits WA)
  let enviados = 0
  let errores  = 0
  const BATCH  = 5
  const DELAY  = 2000

  for (let i = 0; i < clientes.length; i += BATCH) {
    const batch = clientes.slice(i, i + BATCH)

    await Promise.allSettled(batch.map(async (cliente) => {
      const tel = cliente.telefono!
      try {
        if (campana.plantilla_id && campana.plantillas_wa) {
          // Usar plantilla (fuera de ventana 24h)
          await sender.enviarMensaje({ to: tel, texto: campana.plantillas_wa.cuerpo })
        } else if (campana.mensaje_libre) {
          await sender.enviarMensaje({ to: tel, texto: campana.mensaje_libre })
        }
        await admin.from('campana_destinatarios').update({
          estado: 'enviado', enviado_at: new Date().toISOString()
        }).eq('campana_id', id).eq('cliente_id', cliente.id)
        enviados++
      } catch (err) {
        await admin.from('campana_destinatarios').update({
          estado: 'fallido',
          error_detalle: err instanceof Error ? err.message : 'Error desconocido'
        }).eq('campana_id', id).eq('cliente_id', cliente.id)
        errores++
      }
    }))

    // Actualizar contadores intermedios
    await admin.from('campanas').update({ total_enviados: enviados, total_errores: errores }).eq('id', id)

    if (i + BATCH < clientes.length) {
      await new Promise(r => setTimeout(r, DELAY))
    }
  }

  await admin.from('campanas').update({
    estado:          'completada',
    completada_at:   new Date().toISOString(),
    total_enviados:  enviados,
    total_errores:   errores,
    total_destinos:  clientes.length,
  }).eq('id', id)

  return NextResponse.json({ ok: true, enviados, errores })
}
