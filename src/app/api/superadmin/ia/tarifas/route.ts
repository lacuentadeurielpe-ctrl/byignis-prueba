// GET  /api/superadmin/ia/tarifas  — lista todas las tarifas de proveedores IA
// POST /api/superadmin/ia/tarifas  — crea un nuevo modelo/tarifa

import { NextResponse } from 'next/server'
import { requireSuperadminAdmin } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { invalidarCacheTarifas } from '@/lib/credits'

export async function GET(request: Request) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tarifas_ia')
    .select('*')
    .order('proveedor', { ascending: true })
    .order('modelo',    { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tarifas: data })
}

export async function POST(request: Request) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json()
  const { modelo, proveedor, unidad, precio_entrada_por_1k, precio_salida_por_1k, notas } = body

  if (!modelo?.trim() || !proveedor?.trim()) {
    return NextResponse.json({ error: 'modelo y proveedor son requeridos' }, { status: 400 })
  }
  if (!['tokens', 'minutos', 'imagenes'].includes(unidad ?? 'tokens')) {
    return NextResponse.json({ error: 'unidad inválida' }, { status: 400 })
  }
  if (precio_entrada_por_1k < 0 || precio_salida_por_1k < 0) {
    return NextResponse.json({ error: 'Los precios deben ser ≥ 0' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tarifas_ia')
    .insert({
      modelo:                modelo.trim(),
      proveedor:             proveedor.trim(),
      unidad:                unidad ?? 'tokens',
      precio_entrada_por_1k: Number(precio_entrada_por_1k ?? 0),
      precio_salida_por_1k:  Number(precio_salida_por_1k ?? 0),
      notas:                 notas?.trim() ?? null,
      actualizado_at:        new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidarCacheTarifas()
  return NextResponse.json({ tarifa: data }, { status: 201 })
}
