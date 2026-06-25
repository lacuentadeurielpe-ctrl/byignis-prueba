import { createAdminClient } from '@/lib/supabase/admin'
import { inicioDiaLima } from '@/lib/tiempo'
import BillingClient from './BillingClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin   = createAdminClient()
  const inicio30 = inicioDiaLima(-30)

  const [{ data: recargas }, { data: ferreterias }, { data: planes }] = await Promise.all([
    admin.from('recargas_creditos')
      .select('id, ferreteria_id, creditos, motivo, monto_cobrado, created_at, ferreterias(nombre)')
      .gt('monto_cobrado', 0)
      .order('created_at', { ascending: false })
      .limit(200),

    admin.from('ferreterias').select('id, nombre, estado_tenant'),

    admin.from('planes').select('id, nombre, precio_mensual').order('precio_mensual'),
  ])

  // Calcular ingresos 30d
  const pagos   = (recargas ?? [])
  const pagos30 = pagos.filter(r => r.created_at >= inicio30)
  const total30 = pagos30.reduce((s, r) => s + Number(r.monto_cobrado ?? 0), 0)
  const totalHist = pagos.reduce((s, r) => s + Number(r.monto_cobrado ?? 0), 0)

  return {
    pagos,
    total30,
    totalHist,
    ferreterias: ferreterias ?? [],
    planes:      planes ?? [],
  }
}

export default async function BillingPage() {
  const data = await getData()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-gray-400 text-sm mt-1">Registro de pagos recibidos de ferreterías</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Ingresos últimos 30d</p>
          <p className="text-2xl font-bold text-green-400">S/ {data.total30.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mt-1">{data.pagos.filter(r => r.created_at >= new Date(Date.now() - 30 * 86400000).toISOString()).length} pagos</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total histórico</p>
          <p className="text-2xl font-bold text-white">S/ {data.totalHist.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mt-1">{data.pagos.length} pagos registrados</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Ticket promedio</p>
          <p className="text-2xl font-bold text-indigo-400">
            S/ {data.pagos.length > 0 ? (data.totalHist / data.pagos.length).toFixed(2) : '0.00'}
          </p>
          <p className="text-xs text-gray-600 mt-1">por pago</p>
        </div>
      </div>

      <BillingClient pagos={data.pagos} ferreterias={data.ferreterias} planes={data.planes} />
    </div>
  )
}
