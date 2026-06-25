// POST /api/superadmin/ia/facturas/generar
// Genera (o regenera) una factura de gasto IA para un período dado.
// Body: { periodo_inicio: 'YYYY-MM-DD', periodo_fin: 'YYYY-MM-DD', notas?: string }

import { NextResponse } from 'next/server'
import { requireSuperadminAdmin } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'

interface DesgloseModelo {
  llamadas:       number
  tokens_entrada: number
  tokens_salida:  number
  costo_usd:      number
}

interface DesgloseT {
  nombre:    string
  llamadas:  number
  costo_usd: number
}

export async function POST(request: Request) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json()
  const { periodo_inicio, periodo_fin, notas } = body

  // Validar fechas
  if (!periodo_inicio || !periodo_fin) {
    return NextResponse.json({ error: 'periodo_inicio y periodo_fin son requeridos (YYYY-MM-DD)' }, { status: 400 })
  }
  const inicio = new Date(periodo_inicio + 'T00:00:00-05:00') // Lima UTC-5
  const fin    = new Date(periodo_fin    + 'T23:59:59-05:00')
  if (isNaN(inicio.getTime()) || isNaN(fin.getTime()) || inicio > fin) {
    return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 })
  }
  if (fin > new Date()) {
    return NextResponse.json({ error: 'El período no puede ser futuro' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Leer movimientos del período
  const { data: movs, error: errMovs } = await admin
    .from('movimientos_creditos')
    .select('modelo_usado, tokens_entrada, tokens_salida, costo_usd, ferreteria_id, ferreterias(nombre)')
    .gte('created_at', inicio.toISOString())
    .lte('created_at', fin.toISOString())

  if (errMovs) return NextResponse.json({ error: errMovs.message }, { status: 500 })

  const movimientos = movs ?? []

  // Agregar por modelo
  const desgloseModelo: Record<string, DesgloseModelo> = {}
  for (const m of movimientos) {
    const modelo = m.modelo_usado ?? 'desconocido'
    if (!desgloseModelo[modelo]) {
      desgloseModelo[modelo] = { llamadas: 0, tokens_entrada: 0, tokens_salida: 0, costo_usd: 0 }
    }
    desgloseModelo[modelo].llamadas++
    desgloseModelo[modelo].tokens_entrada += Number(m.tokens_entrada ?? 0)
    desgloseModelo[modelo].tokens_salida  += Number(m.tokens_salida  ?? 0)
    desgloseModelo[modelo].costo_usd      += Number(m.costo_usd      ?? 0)
  }

  // Agregar por tenant
  const desgloseT: Record<string, DesgloseT> = {}
  for (const m of movimientos) {
    const fid    = m.ferreteria_id
    const nombre = (m as any).ferreterias?.nombre ?? fid
    if (!desgloseT[fid]) desgloseT[fid] = { nombre, llamadas: 0, costo_usd: 0 }
    desgloseT[fid].llamadas++
    desgloseT[fid].costo_usd += Number(m.costo_usd ?? 0)
  }

  // Totales
  const totalUsd     = movimientos.reduce((s, m) => s + Number(m.costo_usd ?? 0), 0)
  const totalLlamadas = movimientos.length
  const totalTokens  = movimientos.reduce(
    (s, m) => s + Number(m.tokens_entrada ?? 0) + Number(m.tokens_salida ?? 0),
    0
  )

  // Número correlativo: GASTO-YYYY-MM
  const mesLabel = inicio.toISOString().slice(0, 7) // 'YYYY-MM'
  const numero   = `GASTO-${mesLabel}`

  // Upsert (si ya existe factura del mismo número, regenerar)
  const { data: existente } = await admin
    .from('facturas_gasto_ia')
    .select('id, estado')
    .eq('numero', numero)
    .maybeSingle()

  if (existente && existente.estado === 'archivada') {
    return NextResponse.json(
      { error: `La factura ${numero} ya está archivada y no se puede regenerar` },
      { status: 409 }
    )
  }

  let factura
  if (existente) {
    // Regenerar factura existente en borrador/emitida
    const { data, error } = await admin
      .from('facturas_gasto_ia')
      .update({
        periodo_inicio:  periodo_inicio,
        periodo_fin:     periodo_fin,
        total_usd:       Number(totalUsd.toFixed(6)),
        total_llamadas:  totalLlamadas,
        total_tokens:    totalTokens,
        desglose_modelo: desgloseModelo,
        desglose_tenant: desgloseT,
        estado:          'borrador',
        notas:           notas?.trim() ?? null,
        generada_at:     new Date().toISOString(),
        emitida_at:      null,
      })
      .eq('id', existente.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    factura = data
  } else {
    const { data, error } = await admin
      .from('facturas_gasto_ia')
      .insert({
        numero,
        periodo_inicio,
        periodo_fin,
        total_usd:       Number(totalUsd.toFixed(6)),
        total_llamadas:  totalLlamadas,
        total_tokens:    totalTokens,
        desglose_modelo: desgloseModelo,
        desglose_tenant: desgloseT,
        estado:          'borrador',
        notas:           notas?.trim() ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    factura = data
  }

  return NextResponse.json({ factura }, { status: 201 })
}
