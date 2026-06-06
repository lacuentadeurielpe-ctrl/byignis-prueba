import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testQueries() {
  const ferreteriaId = '2a8e8f81-5426-4448-912c-0e2418e22f28' // Necesito un ID real
  const clienteId = 'a1d9b3cc-ebbb-4f40-b472-870ba393fb7a' // Necesito un ID real
  
  // Buscar un cliente de verdad
  const { data: c } = await supabase.from('clientes').select('id, ferreteria_id').limit(1).single()
  if (!c) {
    console.log("No clientes found")
    return
  }

  const fId = c.ferreteria_id
  const cId = c.id
  console.log(`Testing with ferreteria ${fId} and cliente ${cId}`)

  try {
    const { data: cli, error: e1 } = await supabase.from('clientes').select('*').eq('id', cId).single()
    if(e1) throw e1;
    console.log("Cliente fetch OK")

    const { data: ped, error: e2 } = await supabase.from('pedidos').select('id, numero_pedido, estado, estado_pago, total, modalidad, created_at, items_pedido(nombre_producto, cantidad, precio_unitario, subtotal)').eq('cliente_id', cId)
    if(e2) throw e2;
    console.log("Pedidos fetch OK")

    const { data: cot, error: e3 } = await supabase.from('cotizaciones').select('id, numero_cotizacion, estado, total, created_at, items_cotizacion(nombre_producto, cantidad, precio_unitario, subtotal)').eq('cliente_id', cId)
    if(e3) throw e3;
    console.log("Cotizaciones fetch OK")

    const { data: cre, error: e4 } = await supabase.from('creditos').select('id, monto_total, monto_pagado, estado, fecha_vencimiento, created_at').eq('cliente_id', cId)
    if(e4) throw e4;
    console.log("Creditos fetch OK")

    const { data: con, error: e5 } = await supabase.from('conversaciones').select('id, channel, platform_user_id, unread_count, updated_at').eq('cliente_id', cId).limit(1).maybeSingle()
    if(e5) throw e5;
    console.log("Conversaciones fetch OK")

    const { data: opo, error: e6 } = await supabase.from('crm_oportunidades').select('id, titulo, descripcion, estado, valor_estimado, probabilidad_cierre, fecha_cierre_estimada, created_at, cotizacion_id').eq('cliente_id', cId)
    if(e6) throw e6;
    console.log("Oportunidades fetch OK")

    const { data: no, error: e7 } = await supabase.from('cliente_notas').select('id, tipo, contenido, created_at, autor_id').eq('cliente_id', cId)
    if(e7) throw e7;
    console.log("Notas fetch OK")

    console.log("ALL QUERIES PASSED")
  } catch (err) {
    console.error("ERROR IN QUERY:", err)
  }
}

testQueries()
