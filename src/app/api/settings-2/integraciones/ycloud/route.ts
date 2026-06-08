import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('integraciones_conectadas')
      .select('*')
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('tipo', 'ycloud')
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching YCloud integration:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || { estado: 'desconectado' })
  } catch (err) {
    console.error('Error in GET /api/settings-2/integraciones/ycloud:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    // Validar campos requeridos
    if (!body.api_key) {
      return NextResponse.json({ error: 'API Key es requerida' }, { status: 400 })
    }

    // Verificar si existe integración anterior
    const { data: existing } = await supabase
      .from('integraciones_conectadas')
      .select('id')
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('tipo', 'ycloud')
      .single()

    const integrationId = existing?.id || crypto.randomUUID()

    // Guardar/actualizar integración
    const { data, error } = await supabase
      .from('integraciones_conectadas')
      .upsert(
        {
          id: integrationId,
          ferreteria_id: session.ferreteriaId,
          tipo: 'ycloud',
          estado: 'conectado',
          conectado_at: new Date().toISOString(),
          metadata: {
            api_key: body.api_key,
            webhook_secret: body.webhook_secret || null,
            telefono_whatsapp: body.telefono_whatsapp || null,
          },
        },
        { onConflict: 'id' }
      )
      .select()
      .single()

    if (error) {
      console.error('Error saving YCloud integration:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log en audit trail
    await supabase.from('integracion_logs').insert({
      ferreteria_id: session.ferreteriaId,
      integracion_tipo: 'ycloud',
      evento: 'conectado',
      detalle: 'YCloud API conectada',
      usuario_id: session.userId,
    })

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in POST /api/settings-2/integraciones/ycloud:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('integraciones_conectadas')
      .delete()
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('tipo', 'ycloud')

    if (error) {
      console.error('Error deleting YCloud integration:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log en audit trail
    await supabase.from('integracion_logs').insert({
      ferreteria_id: session.ferreteriaId,
      integracion_tipo: 'ycloud',
      evento: 'desconectado',
      detalle: 'YCloud API desconectada',
      usuario_id: session.userId,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in DELETE /api/settings-2/integraciones/ycloud:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
