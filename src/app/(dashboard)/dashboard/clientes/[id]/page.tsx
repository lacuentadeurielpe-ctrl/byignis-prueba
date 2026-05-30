// Historial completo de un cliente (CRM Profile)
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { redirect, notFound } from 'next/navigation'
import ClienteDetalleView from './ClienteDetalleView'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ClienteDetallePage({ params }: Props) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()

  // 1. Datos del cliente
  const { data: cliente } = await supabase
    .from('clientes')
    .select(`
      id, nombre, telefono, dni_ruc, tipo, alias, email,
      telefono_secundario, direccion_habitual, tags, notas_internas, created_at
    `)
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!cliente) notFound()

  // 2. Pedidos del cliente
  const { data: pedidos } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, estado, estado_pago, total, modalidad, created_at, items_pedido(nombre_producto, cantidad, precio_unitario, subtotal)')
    .eq('cliente_id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .order('created_at', { ascending: false })

  // 3. Cotizaciones del cliente
  const { data: cotizaciones } = await supabase
    .from('cotizaciones')
    .select('id, numero_cotizacion, estado, total, created_at')
    .eq('cliente_id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .order('created_at', { ascending: false })

  // 4. Créditos (Cuenta Corriente) del cliente
  const { data: creditos } = await supabase
    .from('creditos')
    .select(`
      id, monto_total, monto_pagado, fecha_limite, estado, created_at, notas,
      pedidos(numero_pedido),
      abonos_credito(id, monto, metodo_pago, notas, created_at)
    `)
    .eq('cliente_id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .order('created_at', { ascending: false })

  // 5. Conversación activa
  const { data: conversacion } = await supabase
    .from('conversaciones')
    .select('id, estado, bot_pausado, ultima_actividad')
    .eq('cliente_id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .order('ultima_actividad', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Cargar últimos mensajes si hay conversación
  let mensajes: any[] = []
  if (conversacion) {
    const { data: msjs } = await supabase
      .from('mensajes')
      .select('id, role, contenido, tipo, created_at')
      .eq('conversacion_id', conversacion.id)
      .order('created_at', { ascending: false })
      .limit(30)
    mensajes = (msjs || []).reverse()
  }

  return (
    <ClienteDetalleView
      cliente={cliente}
      pedidos={pedidos || []}
      cotizaciones={cotizaciones || []}
      creditos={creditos || []}
      conversacion={conversacion ? { ...conversacion, mensajes } : null}
      esDueno={session.rol === 'dueno'}
    />
  )
}
