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
      .from('ferreterias')
      .select(`
        ruc, razon_social, nombre_comercial, tipo_ruc, regimen_tributario,
        serie_boletas, serie_facturas, igv_incluido_en_precios,
        representante_legal_nombre, representante_legal_dni, representante_legal_cargo,
        nubefact_modo
      `)
      .eq('id', session.ferreteriaId)
      .single()

    if (error) {
      console.error('Error fetching facturacion:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || {})
  } catch (err) {
    console.error('Error in GET /api/settings-2/finanzas/facturacion:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    // Validar RUC según tipo
    if (body.tipo_ruc === 'ruc10' && body.ruc && body.ruc.length !== 10) {
      return NextResponse.json({ error: 'RUC debe tener 10 dígitos para RUC10' }, { status: 400 })
    }
    if (body.tipo_ruc === 'ruc20' && body.ruc && body.ruc.length !== 11) {
      return NextResponse.json({ error: 'RUC debe tener 11 dígitos para RUC20' }, { status: 400 })
    }

    // Validar régimen tributario
    const REGIMENES_VALIDOS = ['rer', 'rmt', 'rus', 'general']
    if (body.regimen_tributario && !REGIMENES_VALIDOS.includes(body.regimen_tributario)) {
      return NextResponse.json({ error: 'Régimen tributario inválido' }, { status: 400 })
    }

    const updateData: Record<string, any> = {}
    if (body.ruc !== undefined) updateData.ruc = body.ruc
    if (body.razon_social !== undefined) updateData.razon_social = body.razon_social
    if (body.nombre_comercial !== undefined) updateData.nombre_comercial = body.nombre_comercial
    if (body.tipo_ruc !== undefined) updateData.tipo_ruc = body.tipo_ruc
    if (body.regimen_tributario !== undefined) updateData.regimen_tributario = body.regimen_tributario
    if (body.serie_boletas !== undefined) updateData.serie_boletas = body.serie_boletas
    if (body.serie_facturas !== undefined) updateData.serie_facturas = body.serie_facturas
    if (body.igv_incluido_en_precios !== undefined) updateData.igv_incluido_en_precios = body.igv_incluido_en_precios
    if (body.representante_legal_nombre !== undefined) updateData.representante_legal_nombre = body.representante_legal_nombre
    if (body.representante_legal_dni !== undefined) updateData.representante_legal_dni = body.representante_legal_dni
    if (body.representante_legal_cargo !== undefined) updateData.representante_legal_cargo = body.representante_legal_cargo
    if (body.nubefact_modo !== undefined) updateData.nubefact_modo = body.nubefact_modo

    const { data, error } = await supabase
      .from('ferreterias')
      .update(updateData)
      .eq('id', session.ferreteriaId)
      .select(`
        ruc, razon_social, nombre_comercial, tipo_ruc, regimen_tributario,
        serie_boletas, serie_facturas, igv_incluido_en_precios,
        representante_legal_nombre, representante_legal_dni, representante_legal_cargo,
        nubefact_modo
      `)
      .single()

    if (error) {
      console.error('Error updating facturacion:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/finanzas/facturacion:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
