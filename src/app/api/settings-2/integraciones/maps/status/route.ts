import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('integraciones_conectadas')
      .select('estado, metadata')
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('tipo', 'maps')
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.estado !== 'conectado') {
      return NextResponse.json({ isConnected: false })
    }

    // Retornar si está conectado, sin exponer el API key
    return NextResponse.json({
      isConnected: true,
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || (data?.metadata?.api_key ? '***' : undefined),
    })
  } catch (err) {
    console.error('Error checking Maps status:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
