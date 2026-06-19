import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    // Obtener datos de ferreterias
    const { data, error } = await supabase
      .from('ferreterias')
      .select('nombre, telefono_whatsapp, direccion, email, logo_url, color_comprobante, tipo_establecimiento, ruc, mensaje_comprobante')
      .eq('id', session.ferreteriaId)
      .single()

    if (error) {
      console.error('Error fetching general config:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || {})
  } catch (err) {
    console.error('Error in GET /api/settings-2/negocio/general:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    // Validar nombre
    if (body.nombre !== undefined && (!body.nombre || body.nombre.trim().length === 0)) {
      return NextResponse.json({ error: 'Nombre no puede estar vacío' }, { status: 400 })
    }

    // Validar teléfono (formato E.164 sin +)
    if (body.telefono_whatsapp !== undefined) {
      const phone = body.telefono_whatsapp?.trim()
      if (phone && !/^\d{10,15}$/.test(phone)) {
        return NextResponse.json({ error: 'Teléfono debe ser 10-15 dígitos (sin +)' }, { status: 400 })
      }
    }

    // Actualizar en ferreterias
    const updateData: Record<string, any> = {}
    if (body.nombre !== undefined) updateData.nombre = body.nombre
    if (body.telefono_whatsapp !== undefined) updateData.telefono_whatsapp = body.telefono_whatsapp
    if (body.direccion !== undefined) updateData.direccion = body.direccion
    if (body.email !== undefined) updateData.email = body.email
    if (body.logo_url !== undefined) updateData.logo_url = body.logo_url
    if (body.color_comprobante !== undefined) updateData.color_comprobante = body.color_comprobante
    if (body.tipo_establecimiento !== undefined) updateData.tipo_establecimiento = body.tipo_establecimiento
    if (body.ruc !== undefined) updateData.ruc = body.ruc || null
    if (body.mensaje_comprobante !== undefined) updateData.mensaje_comprobante = body.mensaje_comprobante || null

    const { data, error } = await supabase
      .from('ferreterias')
      .update(updateData)
      .eq('id', session.ferreteriaId)
      .select('nombre, telefono_whatsapp, direccion, email, logo_url, color_comprobante, tipo_establecimiento, ruc, mensaje_comprobante')
      .single()

    if (error) {
      console.error('Error updating general config:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/negocio/general:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
