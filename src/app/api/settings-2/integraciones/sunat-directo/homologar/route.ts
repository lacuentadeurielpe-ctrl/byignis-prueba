// POST /api/settings-2/integraciones/sunat-directo/homologar
// Emite 10 boletas de prueba en modo Beta para completar la homologación SUNAT.
// No requiere pedidos reales.
//
// La emisión de cada boleta la hace SunatDirectoAdapter.emitirBoletaPrueba()
// (misma capa factorizada que las ventas reales). Esta ruta solo orquesta:
// cuántas faltan, acumular entre corridas y auto-promover a producción al llegar a 10.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionInfo } from '@/lib/auth/roles'
import { SunatDirectoAdapter } from '@/lib/facturacion/sunat-directo-adapter'

export const dynamic = 'force-dynamic'
export const maxDuration = 120  // 10 boletas × ~10s c/u

const CANTIDAD_HOMOLOGACION = 10

interface ResultadoBoleta {
  ok:               boolean
  numero_completo?: string
  cdr_codigo?:      string
  error?:           string
}

export async function POST() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createAdminClient()

  // ── Cargar credenciales SUNAT activas ─────────────────────────────────────
  const { data: cred } = await supabase
    .from('sunat_credenciales')
    .select('modo, homologacion_completada_at')
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('estado', 'activo')
    .single()

  if (!cred) {
    return NextResponse.json({ error: 'No hay credenciales SUNAT activas. Configura primero en Integraciones → SUNAT Directo.' }, { status: 400 })
  }
  if (cred.modo !== 'beta') {
    return NextResponse.json({ error: 'La homologación solo se puede realizar en modo Beta.' }, { status: 400 })
  }
  if (cred.homologacion_completada_at) {
    return NextResponse.json({ error: 'La homologación ya fue completada el ' + cred.homologacion_completada_at }, { status: 400 })
  }

  // ── Cuántas boletas de homologación ya fueron aceptadas (acumulado) ────────
  const contarAceptadas = async () => {
    const { count } = await supabase
      .from('comprobantes')
      .select('*', { count: 'exact', head: true })
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('emitido_por', 'homologacion_sunat')
      .eq('estado', 'emitido')
    return count ?? 0
  }

  const completadasPrevias = await contarAceptadas()
  const faltantes = Math.max(0, CANTIDAD_HOMOLOGACION - completadasPrevias)

  // ── Emitir solo las que faltan, delegando en el adapter factorizado ────────
  const adapter = new SunatDirectoAdapter()
  const resultados: ResultadoBoleta[] = []

  for (let i = 0; i < faltantes; i++) {
    const indice = completadasPrevias + i + 1
    const r = await adapter.emitirBoletaPrueba({
      supabase,
      ferreteriaId: session.ferreteriaId,
      indice,
    })
    resultados.push({
      ok:              r.ok,
      numero_completo: r.numeroCompleto,
      cdr_codigo:      r.cdrCodigo,
      error:           r.error,
    })
  }

  // ── Recontar el total real (fuente de verdad) y actualizar credenciales ────
  const completadas = await contarAceptadas()
  const completado  = completadas >= CANTIDAD_HOMOLOGACION

  await supabase
    .from('sunat_credenciales')
    .update({
      homologacion_casos_completados: completadas,
      ...(completado
        ? { homologacion_completada_at: new Date().toISOString(), modo: 'produccion' }
        : {}),
    })
    .eq('ferreteria_id', session.ferreteriaId)

  return NextResponse.json({
    exitosos:   completadas,               // acumulado, no solo esta corrida
    nuevas:     resultados.filter(r => r.ok).length,
    total:      CANTIDAD_HOMOLOGACION,
    completado,
    resultados,
  })
}
