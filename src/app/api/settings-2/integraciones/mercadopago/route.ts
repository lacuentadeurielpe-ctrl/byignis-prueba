import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { encriptar } from '@/lib/encryption'

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
      .eq('tipo', 'mercadopago')
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching Mercado Pago integration:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) return NextResponse.json({ estado: 'desconectado' })

    // Nunca devolver credenciales al navegador — solo lo necesario para la UI
    const meta = (data.metadata ?? {}) as Record<string, unknown>
    return NextResponse.json({
      ...data,
      metadata: {
        public_key: meta.public_key ?? null,
        user_id:    meta.user_id ?? null,
        email:      meta.email ?? null,
        // Solo se informa que existe, jamás su valor
        tiene_access_token: !!(meta.access_token_enc ?? meta.access_token),
      },
    })
  } catch (err) {
    console.error('Error in GET /api/settings-2/integraciones/mercadopago:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    if (!body.access_token) {
      return NextResponse.json({ error: 'Access token es requerido' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('integraciones_conectadas')
      .select('id')
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('tipo', 'mercadopago')
      .single()

    const integrationId = existing?.id || crypto.randomUUID()

    // El access token es una credencial de cobro: se guarda cifrado
    // (AES-256-GCM), igual que YCloud, Meta y SUNAT. Antes iba en texto plano.
    const accessTokenEnc = await encriptar(String(body.access_token).trim())

    const { data, error } = await supabase
      .from('integraciones_conectadas')
      .upsert(
        {
          id: integrationId,
          ferreteria_id: session.ferreteriaId,
          tipo: 'mercadopago',
          estado: 'conectado',
          conectado_at: new Date().toISOString(),
          metadata: {
            access_token_enc: accessTokenEnc,
            public_key: body.public_key || null,
            user_id: body.user_id || null,
            email: body.email || null,
          },
        },
        { onConflict: 'id' }
      )
      .select()
      .single()

    if (error) {
      console.error('Error saving Mercado Pago integration:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('integracion_logs').insert({
      ferreteria_id: session.ferreteriaId,
      integracion_tipo: 'mercadopago',
      evento: 'conectado',
      detalle: `Mercado Pago conectada como ${body.email || 'cuenta'}`,
      usuario_id: session.userId,
    })

    // Sin credenciales en la respuesta
    return NextResponse.json({
      ...data,
      metadata: { public_key: body.public_key || null, email: body.email || null, tiene_access_token: true },
    })
  } catch (err) {
    console.error('Error in POST /api/settings-2/integraciones/mercadopago:', err)
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
      .eq('tipo', 'mercadopago')

    if (error) {
      console.error('Error deleting Mercado Pago integration:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('integracion_logs').insert({
      ferreteria_id: session.ferreteriaId,
      integracion_tipo: 'mercadopago',
      evento: 'desconectado',
      detalle: 'Mercado Pago desconectada',
      usuario_id: session.userId,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in DELETE /api/settings-2/integraciones/mercadopago:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
