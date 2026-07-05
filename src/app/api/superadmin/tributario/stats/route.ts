// GET /api/superadmin/tributario/stats — estadísticas tributarias globales

import { NextResponse } from 'next/server'
import { verificarSuperadminAPI } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const session = await verificarSuperadminAPI(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()

  // Primer día del mes actual
  const ahora = new Date()
  const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString()
  const primerDiaSigMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1).toISOString()

  // YYYYMM del mes actual
  const periodoActual = `${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}`

  const [
    { data: comprobantesData },
    { data: ferreteriasData },
    { data: credsActivas },
    { data: librosData },
    { data: librosCerradosData },
  ] = await Promise.all([
    // Comprobantes emitidos este mes
    admin
      .from('comprobantes')
      .select('igv, total')
      .in('tipo', ['boleta', 'factura'])
      .eq('estado', 'emitido')
      .gte('created_at', primerDiaMes)
      .lt('created_at', primerDiaSigMes),

    // Total de ferreterías
    admin
      .from('ferreterias')
      .select('id'),

    // Ferreterías con facturación electrónica activa (SUNAT Directo)
    admin
      .from('sunat_credenciales')
      .select('ferreteria_id')
      .eq('estado', 'activo'),

    // Libros generados este mes
    admin
      .from('libros_contables')
      .select('id')
      .eq('periodo', periodoActual),

    // Libros cerrados este mes
    admin
      .from('libros_contables')
      .select('id')
      .eq('periodo', periodoActual)
      .eq('estado', 'cerrado'),
  ])

  const comprobantes = comprobantesData ?? []
  const igv_mes    = comprobantes.reduce((s, c) => s + (Number(c.igv) ?? 0), 0)
  const ventas_mes = comprobantes.reduce((s, c) => s + (Number(c.total) ?? 0), 0)

  const totalFerreterias = (ferreteriasData ?? []).length
  const conFacturacion   = new Set((credsActivas ?? []).map(c => c.ferreteria_id)).size

  return NextResponse.json({
    comprobantes_mes:        comprobantes.length,
    igv_mes:                 Math.round(igv_mes * 100) / 100,
    ventas_mes:              Math.round(ventas_mes * 100) / 100,
    tenants_con_facturacion: conFacturacion,
    tenants_sin_facturacion: Math.max(0, totalFerreterias - conFacturacion),
    libros_generados_mes:    (librosData ?? []).length,
    libros_cerrados_mes:     (librosCerradosData ?? []).length,
  })
}
