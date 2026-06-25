// GET  /api/superadmin/ia/precios  — lista paquetes/tarifas que cobramos a tenants
// POST /api/superadmin/ia/precios  — crea nuevo paquete

import { NextResponse } from 'next/server'
import { requireSuperadminAdmin } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tarifas_creditos')
    .select('*')
    .order('tipo',      { ascending: true })
    .order('precio_usd', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ precios: data })
}

export async function POST(request: Request) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json()
  const { nombre, tipo, creditos, precio_usd, precio_pen, es_default, descripcion } = body

  if (!nombre?.trim()) return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 })
  if (!['por_lote', 'por_credito', 'mensual'].includes(tipo)) {
    return NextResponse.json({ error: 'tipo inválido: por_lote | por_credito | mensual' }, { status: 400 })
  }
  if (Number(precio_usd) < 0) {
    return NextResponse.json({ error: 'precio_usd debe ser ≥ 0' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Si se marca como default, desactivar el anterior
  if (es_default) {
    await admin
      .from('tarifas_creditos')
      .update({ es_default: false, updated_at: new Date().toISOString() })
      .eq('es_default', true)
  }

  const { data, error } = await admin
    .from('tarifas_creditos')
    .insert({
      nombre:      nombre.trim(),
      tipo,
      creditos:    Number(creditos ?? 0),
      precio_usd:  Number(precio_usd),
      precio_pen:  precio_pen != null ? Number(precio_pen) : null,
      es_default:  Boolean(es_default),
      descripcion: descripcion?.trim() ?? null,
      updated_at:  new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ precio: data }, { status: 201 })
}
