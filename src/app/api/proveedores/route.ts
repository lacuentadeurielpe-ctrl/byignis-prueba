import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getSessionInfo } from '@/lib/auth/roles'

// GET /api/proveedores — Listar todos los proveedores
export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = await getDB()
  try {
    const proveedores = await db.proveedores.listarProveedores(session.ferreteriaId)
    return NextResponse.json(proveedores)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/proveedores — Crear un nuevo proveedor
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = await getDB()
  try {
    const body = await request.json()
    const { nombre, telefono, contacto } = body

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre del proveedor es requerido' }, { status: 400 })
    }

    const nuevo = await db.proveedores.crearProveedor(session.ferreteriaId, {
      nombre: nombre.trim(),
      telefono: telefono || null,
      contacto: contacto || null,
    })

    return NextResponse.json(nuevo, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
