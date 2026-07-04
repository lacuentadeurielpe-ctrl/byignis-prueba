// GET /api/comprobantes/salud-fiscal — panel de estado fiscal (Fase 4)
//
// Reemplaza el antiguo flujo manual de "Resumen Diario" (declarar boletas a
// mano) por una vista de solo lectura: todo lo que el sistema ya resolvió
// solo, y lo poco que de verdad necesita que el dueño decida algo.

import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { detectarExcepciones } from '@/lib/facturacion/conciliacion'

export const dynamic = 'force-dynamic'

function inicioMesLima(): string {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  return `${hoy.slice(0, 7)}-01`
}

export async function GET() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()
  const desde = inicioMesLima()

  const [{ data: comprobantesMes }, { excepciones }, { data: enTramite }] = await Promise.all([
    supabase
      .from('comprobantes')
      .select('estado_sunat, total, tipo')
      .eq('ferreteria_id', session.ferreteriaId)
      .in('tipo', ['boleta', 'factura'])
      .gte('fecha_emision', desde),
    detectarExcepciones(supabase, session.ferreteriaId),
    supabase
      .from('comprobantes')
      .select('id, numero_completo, tipo, anulacion_solicitada_at, estado_sunat')
      .eq('ferreteria_id', session.ferreteriaId)
      .or('anulacion_solicitada.eq.true,estado_sunat.eq.baja_pendiente')
      .order('anulacion_solicitada_at', { ascending: false }),
  ])

  const filas = comprobantesMes ?? []
  const semaforo = {
    aceptados:  filas.filter(c => c.estado_sunat === 'aceptado' || c.estado_sunat === 'aceptado_obs').length,
    enReintento: filas.filter(c => c.estado_sunat === 'error_reintentable').length,
    rechazados: filas.filter(c => c.estado_sunat === 'rechazado').length,
    anulados:   filas.filter(c => c.estado_sunat === 'anulado' || c.estado_sunat === 'baja').length,
    totalMes:   filas.reduce((acc, c) => acc + (Number(c.total) || 0), 0),
  }

  return NextResponse.json({
    semaforo,
    excepciones,
    anulacionesEnTramite: enTramite ?? [],
  })
}
