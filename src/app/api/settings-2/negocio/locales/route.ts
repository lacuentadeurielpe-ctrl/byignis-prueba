import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { LocalFormData } from '@/types/locales'
import { validarCamposSunatLocal } from '@/lib/sucursales/series'

export const dynamic = 'force-dynamic'

// GET /api/settings-2/negocio/locales
export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('locales_ferreteria')
      .select('*')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('es_principal', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error fetching locales:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/settings-2/negocio/locales
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()

  try {
    const body: LocalFormData = await request.json()

    if (!body.nombre || !body.direccion) {
      return NextResponse.json({ error: 'Nombre y dirección requeridos' }, { status: 400 })
    }

    const errorSunat = await validarCamposSunatLocal(supabase, session.ferreteriaId, body, null)
    if (errorSunat) return NextResponse.json({ error: errorSunat }, { status: 400 })

    // Si es principal, desactiva otros
    if (body.es_principal) {
      await supabase
        .from('locales_ferreteria')
        .update({ es_principal: false })
        .eq('ferreteria_id', session.ferreteriaId)
    }

    const { data, error } = await supabase
      .from('locales_ferreteria')
      .insert({
        ferreteria_id: session.ferreteriaId,
        nombre: body.nombre,
        codigo: body.codigo,
        descripcion: body.descripcion,
        direccion: body.direccion,
        lat: body.lat,
        lng: body.lng,
        place_id: body.place_id,
        telefono: body.telefono,
        horario_apertura: body.horario_apertura,
        horario_cierre: body.horario_cierre,
        dias_atencion: body.dias_atencion || [],
        es_principal: body.es_principal ?? false,
        activo: true,
        codigo_sunat:   body.codigo_sunat?.trim() || '0000',
        serie_boletas:  body.serie_boletas?.trim().toUpperCase() || null,
        serie_facturas: body.serie_facturas?.trim().toUpperCase() || null,
        ubigeo:         body.ubigeo,
        departamento:   body.departamento,
        provincia:      body.provincia,
        distrito:       body.distrito,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('Error creating local:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
