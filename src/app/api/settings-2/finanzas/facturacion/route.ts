import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

// ── Validaciones SUNAT ─────────────────────────────────────────────────────────

function validarDigitoVerificador(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc)) return false
  const factores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = factores.reduce((acc, f, i) => acc + f * parseInt(ruc[i]), 0)
  let check = 11 - (suma % 11)
  if (check === 10) check = 0
  if (check === 11) check = 1
  return parseInt(ruc[10]) === check
}

function validarRuc(
  ruc: string,
  tipoRuc: 'ruc10' | 'ruc20'
): { ok: true } | { ok: false; mensaje: string } {
  const d = ruc.replace(/\D/g, '')
  if (d.length !== 11) return { ok: false, mensaje: 'El RUC debe tener exactamente 11 dígitos' }
  const prefijo = tipoRuc === 'ruc10' ? '10' : '20'
  if (!d.startsWith(prefijo))
    return {
      ok: false,
      mensaje: `Un RUC de ${tipoRuc === 'ruc10' ? 'Persona Natural' : 'Empresa'} debe empezar con ${prefijo}`,
    }
  if (!validarDigitoVerificador(d))
    return { ok: false, mensaje: 'RUC inválido (dígito verificador incorrecto)' }
  return { ok: true }
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno')
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ferreterias')
    .select(
      `ruc, razon_social, nombre_comercial, tipo_ruc, regimen_tributario,
       serie_boletas, serie_facturas, igv_incluido_en_precios,
       representante_legal_nombre, representante_legal_dni, representante_legal_cargo,
       nubefact_modo`
    )
    .eq('id', session.ferreteriaId)
    .single()

  if (error) {
    console.error('[facturacion GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? {})
}

// ── PATCH ──────────────────────────────────────────────────────────────────────

export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno')
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // Validar RUC cuando se proporciona y el tipo no es sin_ruc
  if (body.ruc && body.tipo_ruc && body.tipo_ruc !== 'sin_ruc') {
    const rucLimpio = (body.ruc as string).replace(/\D/g, '')
    const resultado = validarRuc(rucLimpio, body.tipo_ruc as 'ruc10' | 'ruc20')
    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.mensaje }, { status: 400 })
    }
    body = { ...body, ruc: rucLimpio }
  }

  // Validar régimen tributario
  const REGIMENES_VALIDOS = ['rer', 'rmt', 'rus', 'general']
  if (body.regimen_tributario && !REGIMENES_VALIDOS.includes(body.regimen_tributario as string)) {
    return NextResponse.json({ error: 'Régimen tributario inválido' }, { status: 400 })
  }

  // Validar series
  if (body.serie_boletas) {
    const serie = (body.serie_boletas as string).toUpperCase()
    if (!/^B\d{3}$/.test(serie)) {
      return NextResponse.json(
        { error: 'Serie de boletas inválida — debe ser B seguida de 3 dígitos (ej: B001)' },
        { status: 400 }
      )
    }
    body = { ...body, serie_boletas: serie }
  }
  if (body.serie_facturas) {
    const serie = (body.serie_facturas as string).toUpperCase()
    if (!/^F\d{3}$/.test(serie)) {
      return NextResponse.json(
        { error: 'Serie de facturas inválida — debe ser F seguida de 3 dígitos (ej: F001)' },
        { status: 400 }
      )
    }
    body = { ...body, serie_facturas: serie }
  }

  // Validar DNI representante (si se envía)
  if (body.representante_legal_dni) {
    const dni = (body.representante_legal_dni as string).replace(/\D/g, '')
    if (dni.length !== 8) {
      return NextResponse.json(
        { error: 'DNI del representante legal debe tener exactamente 8 dígitos' },
        { status: 400 }
      )
    }
    body = { ...body, representante_legal_dni: dni }
  }

  const CAMPOS_PERMITIDOS = [
    'ruc',
    'razon_social',
    'nombre_comercial',
    'tipo_ruc',
    'regimen_tributario',
    'serie_boletas',
    'serie_facturas',
    'igv_incluido_en_precios',
    'representante_legal_nombre',
    'representante_legal_dni',
    'representante_legal_cargo',
    'nubefact_modo',
  ]

  const updateData: Record<string, unknown> = {}
  for (const campo of CAMPOS_PERMITIDOS) {
    if (body[campo] !== undefined) updateData[campo] = body[campo]
  }

  const { data, error } = await supabase
    .from('ferreterias')
    .update(updateData)
    .eq('id', session.ferreteriaId)
    .select(
      `ruc, razon_social, nombre_comercial, tipo_ruc, regimen_tributario,
       serie_boletas, serie_facturas, igv_incluido_en_precios,
       representante_legal_nombre, representante_legal_dni, representante_legal_cargo,
       nubefact_modo`
    )
    .single()

  if (error) {
    console.error('[facturacion PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
