import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

/**
 * Template para API routes de settings-2
 * Copia este archivo y reemplaza [MODULE] con el nombre del módulo
 * Ej: GET /api/settings-2/negocio/general
 */

// GET /api/settings-2/[MODULE]/[ACTION]
export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    // Obtener configuración del módulo
    const { data, error } = await supabase
      .from('configuracion_general')
      .select('[MODULE]_config')
      .eq('ferreteria_id', session.ferreteriaId)
      .single()

    if (error) {
      console.error('Error fetching config:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || {})
  } catch (err) {
    console.error('Error in GET:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH /api/settings-2/[MODULE]/[ACTION]
export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    // Validar datos aquí

    // Actualizar configuración
    const { data, error } = await supabase
      .from('configuracion_general')
      .update({ '[MODULE]_config': body, updated_at: new Date().toISOString() })
      .eq('ferreteria_id', session.ferreteriaId)
      .select('[MODULE]_config')
      .single()

    if (error) {
      console.error('Error updating config:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Registrar en audit log
    await supabase.from('integracion_logs').insert({
      ferreteria_id: session.ferreteriaId,
      integracion_tipo: '[MODULE]',
      evento: 'config_updated',
      detalle: JSON.stringify(body),
      usuario_id: session.userId,
    })

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in PATCH:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
