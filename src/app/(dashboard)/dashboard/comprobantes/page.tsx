import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { Receipt } from 'lucide-react'
import ComprobantesTable from '@/components/comprobantes/ComprobantesTable'
import CertificadoBanner from '@/components/comprobantes/CertificadoBanner'
import { FacturacionRepository } from '@/lib/db/repositories/facturacion'

export const dynamic = 'force-dynamic'

export default async function ComprobantesPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()
  const facturacionRepo = new FacturacionRepository(supabase)

  const [comprobantes, credSunat] = await Promise.all([
    facturacionRepo.obtenerComprobantesDashboard(session.ferreteriaId),
    supabase
      .from('sunat_credenciales')
      .select('cert_vence_at')
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('estado', 'activo')
      .maybeSingle()
      .then(r => r.data),
  ])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-zinc-100 border border-zinc-200 rounded-2xl flex items-center justify-center">
          <Receipt className="w-5 h-5 text-zinc-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-950 tracking-tight">Facturación Electrónica</h1>
          <p className="text-sm text-zinc-500">Gestiona tus boletas, facturas y notas de crédito de SUNAT</p>
        </div>
      </div>

      {/* Aviso de certificado por vencer/expirado */}
      <CertificadoBanner certVenceAt={credSunat?.cert_vence_at ?? null} />

      <ComprobantesTable
        comprobantes={comprobantes ?? []}
        facturacionConfigurada={!!credSunat}
        ferreteriaId={session.ferreteriaId}
      />
    </div>
  )
}
