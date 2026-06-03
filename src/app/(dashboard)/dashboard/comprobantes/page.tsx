import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { Receipt, FileText } from 'lucide-react'
import ComprobantesTable from '@/components/comprobantes/ComprobantesTable'
import { FacturacionRepository } from '@/lib/db/repositories/facturacion'

export const dynamic = 'force-dynamic'

export default async function ComprobantesPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()
  const facturacionRepo = new FacturacionRepository(supabase)

  // Obtener comprobantes y ferretería
  const [comprobantes, ferreteriaData] = await Promise.all([
    facturacionRepo.obtenerComprobantesDashboard(session.ferreteriaId),
    facturacionRepo.obtenerConfiguracionFacturacion(session.ferreteriaId),
  ])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-zinc-100 border border-zinc-200 rounded-2xl flex items-center justify-center">
          <Receipt className="w-5 h-5 text-zinc-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-950 tracking-tight">Facturación Electrónica</h1>
          <p className="text-sm text-zinc-500">Gestiona tus boletas, facturas y notas de crédito de SUNAT</p>
        </div>
      </div>

      <ComprobantesTable 
        comprobantes={comprobantes ?? []}
        nubefactConfigurado={!!ferreteriaData?.nubefact_token_enc}
      />
    </div>
  )
}
