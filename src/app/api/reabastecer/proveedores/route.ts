import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

// GET /api/reabastecer/proveedores — Listar proveedores del tenant
export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .eq('ferreteria_id', session.ferreteriaId)
    .order('nombre', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/reabastecer/proveedores — Crear un proveedor para el tenant
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { nombre, telefono, contacto } = body

  if (!nombre?.trim()) {
    return NextResponse.json({ error: 'El nombre del proveedor es obligatorio.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proveedores')
    .insert({
      ferreteria_id: session.ferreteriaId,
      nombre: nombre.trim(),
      telefono: telefono?.trim() || null,
      contacto: contacto?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
