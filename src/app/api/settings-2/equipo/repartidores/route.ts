import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { hashPin } from '@/lib/pin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('repartidores')
      .select('id, nombre, telefono, pin, token, estado, zonas_asignadas, puede_registrar_deuda, limite_deuda_monto, limite_deuda_porcentaje, created_at')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching repartidores:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('Error in GET /api/settings-2/equipo/repartidores:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    if (!body.nombre || !body.telefono) {
      return NextResponse.json({ error: 'Nombre y teléfono son requeridos' }, { status: 400 })
    }

    const pin = Math.floor(1000 + Math.random() * 9000).toString()
    const pin_hash = hashPin(pin)
    const token = crypto.randomBytes(32).toString('hex')

    const { data, error } = await supabase
      .from('repartidores')
      .insert({
        ferreteria_id: session.ferreteriaId,
        nombre: body.nombre,
        telefono: body.telefono,
        pin,
        pin_hash,
        token,
        estado: 'activo',
        zonas_asignadas: body.zonas_asignadas || [],
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating repartidor:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('integracion_logs').insert({
      ferreteria_id: session.ferreteriaId,
      integracion_tipo: 'equipo',
      evento: 'repartidor_agregado',
      detalle: `Repartidor ${body.nombre} agregado con PIN ${pin}`,
      usuario_id: session.userId,
    })

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in POST /api/settings-2/equipo/repartidores:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    // Acción especial: generar o regenerar token + pin_hash para repartidores sin acceso
    if (body.accion === 'generar_token') {
      const { data: rep } = await supabase
        .from('repartidores')
        .select('pin')
        .eq('id', body.id)
        .eq('ferreteria_id', session.ferreteriaId)
        .single()

      if (!rep) return NextResponse.json({ error: 'Repartidor no encontrado' }, { status: 404 })

      const nuevoToken = crypto.randomBytes(32).toString('hex')
      const nuevoPinHash = hashPin(rep.pin)

      const { data, error } = await supabase
        .from('repartidores')
        .update({ token: nuevoToken, pin_hash: nuevoPinHash })
        .eq('id', body.id)
        .eq('ferreteria_id', session.ferreteriaId)
        .select('id, nombre, telefono, pin, token, estado, zonas_asignadas, puede_registrar_deuda, limite_deuda_monto, limite_deuda_porcentaje, created_at')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    // Acción especial: actualizar permisos de cobro parcial (deuda)
    if (body.accion === 'actualizar_permisos') {
      const { puede_registrar_deuda, limite_deuda_monto, limite_deuda_porcentaje } = body

      if (typeof puede_registrar_deuda !== 'boolean') {
        return NextResponse.json({ error: 'puede_registrar_deuda debe ser boolean' }, { status: 400 })
      }

      // Validar límites si se envían
      if (limite_deuda_monto !== null && limite_deuda_monto !== undefined) {
        if (typeof limite_deuda_monto !== 'number' || limite_deuda_monto <= 0) {
          return NextResponse.json({ error: 'limite_deuda_monto debe ser un número positivo' }, { status: 400 })
        }
      }
      if (limite_deuda_porcentaje !== null && limite_deuda_porcentaje !== undefined) {
        if (typeof limite_deuda_porcentaje !== 'number' || limite_deuda_porcentaje < 1 || limite_deuda_porcentaje > 100) {
          return NextResponse.json({ error: 'limite_deuda_porcentaje debe estar entre 1 y 100' }, { status: 400 })
        }
      }

      const { data, error } = await supabase
        .from('repartidores')
        .update({
          puede_registrar_deuda,
          limite_deuda_monto:      puede_registrar_deuda ? (limite_deuda_monto ?? null) : null,
          limite_deuda_porcentaje: puede_registrar_deuda ? (limite_deuda_porcentaje ?? null) : null,
        })
        .eq('id', body.id)
        .eq('ferreteria_id', session.ferreteriaId)
        .select('id, nombre, puede_registrar_deuda, limite_deuda_monto, limite_deuda_porcentaje')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    const updateData: Record<string, any> = {}
    if (body.nombre !== undefined) updateData.nombre = body.nombre
    if (body.telefono !== undefined) updateData.telefono = body.telefono
    if (body.estado !== undefined) updateData.estado = body.estado
    if (body.zonas_asignadas !== undefined) updateData.zonas_asignadas = body.zonas_asignadas

    const { data, error } = await supabase
      .from('repartidores')
      .update(updateData)
      .eq('id', body.id)
      .eq('ferreteria_id', session.ferreteriaId)
      .select()
      .single()

    if (error) {
      console.error('Error updating repartidor:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/equipo/repartidores:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { searchParams } = new URL(request.url)
    const repartidorId = searchParams.get('id')

    if (!repartidorId) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const { data: repartidor } = await supabase
      .from('repartidores')
      .select('nombre')
      .eq('id', repartidorId)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()

    const { error } = await supabase
      .from('repartidores')
      .delete()
      .eq('id', repartidorId)
      .eq('ferreteria_id', session.ferreteriaId)

    if (error) {
      console.error('Error deleting repartidor:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('integracion_logs').insert({
      ferreteria_id: session.ferreteriaId,
      integracion_tipo: 'equipo',
      evento: 'repartidor_eliminado',
      detalle: `Repartidor ${repartidor?.nombre} eliminado`,
      usuario_id: session.userId,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in DELETE /api/settings-2/equipo/repartidores:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
