import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

// GET /api/clientes/[id] — obtener ficha completa del cliente
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id } = await params

  const { data, error } = await supabase
    .from('clientes')
    .select(`
      id, ferreteria_id, nombre, telefono, dni_ruc, tipo, alias,
      email, telefono_secundario, direccion_habitual, tags, notas_internas,
      perfil, created_at, updated_at,
      pedidos(id, numero_pedido, total, estado, created_at),
      creditos(id, monto_total, monto_pagado, estado, fecha_limite)
    `)
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)   // ← aislamiento multi-tenancy
    .single()

  if (error || !data)
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  return NextResponse.json(data)
}

// PATCH /api/clientes/[id] — actualizar ficha del cliente
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  const {
    nombre,
    alias,
    dni_ruc,
    tipo,
    email,
    telefono_secundario,
    direccion_habitual,
    tags,
    notas_internas,
    limite_credito_monto,
  } = body

  // Validar tipo
  const TIPOS_VALIDOS = ['persona', 'empresa', 'anonimo']
  if (tipo && !TIPOS_VALIDOS.includes(tipo))
    return NextResponse.json({ error: 'Tipo de cliente inválido' }, { status: 400 })

  // Validar DNI/RUC si se provee
  if (dni_ruc !== undefined && dni_ruc !== null && dni_ruc !== '') {
    const limpio = dni_ruc.replace(/\D/g, '')
    if (limpio.length !== 8 && limpio.length !== 11)
      return NextResponse.json({ error: 'DNI debe tener 8 dígitos o RUC 11 dígitos' }, { status: 400 })
  }

  // Verificar que el cliente existe y pertenece al tenant (multi-tenancy)
  const { data: clienteActual } = await supabase
    .from('clientes')
    .select('id')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!clienteActual)
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  // Construir objeto de actualización solo con los campos provistos
  const updates: Record<string, unknown> = {}
  if (nombre !== undefined) updates.nombre = nombre?.trim() || null
  if (alias !== undefined) updates.alias = alias?.trim() || null
  if (dni_ruc !== undefined) updates.dni_ruc = dni_ruc?.replace(/\D/g, '') || null
  if (tipo !== undefined) updates.tipo = tipo
  if (email !== undefined) updates.email = email?.trim() || null
  if (telefono_secundario !== undefined) updates.telefono_secundario = telefono_secundario?.trim() || null
  if (direccion_habitual !== undefined) updates.direccion_habitual = direccion_habitual?.trim() || null
  if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags : []
  if (notas_internas !== undefined) updates.notas_internas = notas_internas?.trim() || null
  if (limite_credito_monto !== undefined) {
    if (limite_credito_monto === null || limite_credito_monto === '') {
      updates.limite_credito_monto = null
    } else {
      const monto = Number(limite_credito_monto)
      if (isNaN(monto) || monto < 0) {
        return NextResponse.json({ error: 'Límite de crédito inválido' }, { status: 400 })
      }
      updates.limite_credito_monto = monto
    }
  }

  const { data, error } = await supabase
    .from('clientes')
    .update(updates)
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)  // ← doble verificación multi-tenancy
    .select('id, nombre, alias, dni_ruc, tipo, email, telefono_secundario, direccion_habitual, tags, notas_internas, limite_credito_monto')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

// DELETE /api/clientes/[id] — eliminar cliente (solo dueño)
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Solo dueño puede eliminar clientes
  if (session.rol !== 'dueno') {
    return NextResponse.json({ error: 'No tienes permisos para eliminar clientes' }, { status: 403 })
  }

  const supabase = await createClient()
  const { id } = await params

  try {
    // Verificar que el cliente existe y pertenece a la ferretería
    const { data: cliente, error: getError } = await supabase
      .from('clientes')
      .select('id')
      .eq('id', id)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()

    if (getError || !cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // Eliminar cliente (en cascada por configuración de BD)
    const { error: deleteError } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id)
      .eq('ferreteria_id', session.ferreteriaId)

    if (deleteError) {
      console.error('Error deleting cliente:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json(null, { status: 204 })
  } catch (err) {
    console.error('Error in DELETE /api/clientes/[id]:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
