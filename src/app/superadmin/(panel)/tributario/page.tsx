// /superadmin/tributario — Sección tributaria: comprobantes, libros, IGV

import { redirect } from 'next/navigation'
import { getSuperadminSession } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'
import TributarioPanel from '@/components/superadmin/TributarioPanel'

export const dynamic = 'force-dynamic'

async function getTributarioStats() {
  const admin = createAdminClient()

  const ahora = new Date()
  const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString()
  const primerDiaSigMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1).toISOString()
  const periodoActual = `${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}`

  const [
    { data: comprobantesData },
    { data: ferreteriasData },
    { data: credsActivas },
    { data: librosData },
    { data: librosCerradosData },
  ] = await Promise.all([
    admin
      .from('comprobantes')
      .select('igv, total')
      .in('tipo', ['boleta', 'factura'])
      .eq('estado', 'emitido')
      .gte('created_at', primerDiaMes)
      .lt('created_at', primerDiaSigMes),

    admin.from('ferreterias').select('id'),
    admin.from('sunat_credenciales').select('ferreteria_id').eq('estado', 'activo'),

    admin.from('libros_contables').select('id').eq('periodo', periodoActual),
    admin.from('libros_contables').select('id').eq('periodo', periodoActual).eq('estado', 'cerrado'),
  ])

  const comprobantes = comprobantesData ?? []
  const igv_mes    = comprobantes.reduce((s, c) => s + (Number(c.igv) ?? 0), 0)
  const ventas_mes = comprobantes.reduce((s, c) => s + (Number(c.total) ?? 0), 0)

  const totalFerreterias = (ferreteriasData ?? []).length
  const conFacturacion   = new Set((credsActivas ?? []).map(c => c.ferreteria_id)).size

  return {
    comprobantes_mes:        comprobantes.length,
    igv_mes:                 Math.round(igv_mes * 100) / 100,
    ventas_mes:              Math.round(ventas_mes * 100) / 100,
    tenants_con_facturacion: conFacturacion,
    tenants_sin_facturacion: Math.max(0, totalFerreterias - conFacturacion),
    libros_generados_mes:    (librosData ?? []).length,
    libros_cerrados_mes:     (librosCerradosData ?? []).length,
  }
}

export default async function TributarioPage() {
  const session = await getSuperadminSession()
  if (!session) redirect('/superadmin/login')

  const stats = await getTributarioStats()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Tributario</h1>
        <p className="text-gray-400 text-sm mt-1">Comprobantes, libros contables e IGV</p>
      </div>
      <TributarioPanel stats={stats} />
    </div>
  )
}
