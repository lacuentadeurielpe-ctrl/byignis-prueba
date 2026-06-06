require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const ferreteriaId = '32e14714-dfae-4a90-8cb9-41eb7d90a8d2';
  const clienteId = 'fc23ab21-6d09-4dd2-b8b2-f593b56ebe78';

  try {
    console.log('Fetching cliente...');
    const { data: cliente, error: e1 } = await supabase
      .from('clientes')
      .select('id, nombre, telefono, dni_ruc, tipo, alias, email, telefono_secundario, direccion_habitual, tags, notas_internas, created_at')
      .eq('id', clienteId)
      .eq('ferreteria_id', ferreteriaId)
      .single();
    if (e1) throw e1;
    console.log('Cliente OK');

    console.log('Fetching pedidos...');
    const { data: p, error: e2 } = await supabase.from('pedidos').select('id, numero_pedido, estado, estado_pago, total, modalidad, created_at, items_pedido(nombre_producto, cantidad, precio_unitario, subtotal)').eq('cliente_id', clienteId).eq('ferreteria_id', ferreteriaId);
    if (e2) throw e2;
    console.log('Pedidos OK');

    console.log('Fetching cotizaciones...');
    const { data: c, error: e3 } = await supabase.from('cotizaciones').select('id, numero_cotizacion, estado, total, created_at, items_cotizacion(nombre_producto, cantidad, precio_unitario, subtotal)').eq('cliente_id', clienteId).eq('ferreteria_id', ferreteriaId);
    if (e3) throw e3;
    console.log('Cotizaciones OK');

    console.log('Fetching creditos...');
    const { data: cr, error: e4 } = await supabase.from('creditos').select('id, monto_total, monto_pagado, estado, fecha_limite, created_at').eq('cliente_id', clienteId).eq('ferreteria_id', ferreteriaId);
    if (e4) throw e4;
    console.log('Creditos OK');

    console.log('Fetching conversaciones...');
    const { data: co, error: e5 } = await supabase.from('conversaciones').select('*').eq('cliente_id', clienteId).eq('ferreteria_id', ferreteriaId).limit(1).maybeSingle();
    if (e5) throw e5;
    console.log('Conversaciones OK');

    console.log('Fetching oportunidades...');
    const { data: op, error: e6 } = await supabase.from('crm_oportunidades').select('id, titulo, descripcion, estado, valor_estimado, probabilidad_cierre, fecha_cierre_estimada, created_at, cotizacion_id').eq('cliente_id', clienteId).eq('ferreteria_id', ferreteriaId);
    if (e6) throw e6;
    console.log('Oportunidades OK');

    console.log('Fetching notas...');
    const { data: no, error: e7 } = await supabase.from('cliente_notas').select('id, tipo, contenido, created_at, autor_id').eq('cliente_id', clienteId).eq('ferreteria_id', ferreteriaId);
    if (e7) throw e7;
    console.log('Notas OK');

    console.log('ALL OK');
  } catch (err) {
    console.error('ERRORRR:', err);
  }
}

run();
