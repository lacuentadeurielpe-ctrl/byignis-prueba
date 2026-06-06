import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { Target } from 'lucide-react'
import CRMBoard from '@/components/crm/CRMBoard'

export const dynamic = 'force-dynamic'

export default async function CRMPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()

  // Obtener oportunidades y cruzarlas con clientes
  const { data: oportunidades, error } = await supabase
    .from('crm_oportunidades')
    .select(`
      id, titulo, descripcion, estado, valor_estimado, probabilidad_cierre, fecha_cierre_estimada, created_at,
      clientes!inner(id, nombre, alias, tipo)
    `)
    .eq('ferreteria_id', session.ferreteriaId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error cargando CRM:', error)
  }

  const { data: clientesCombo } = await supabase
    .from('clientes')
    .select('id, nombre, alias, tipo')
    .eq('ferreteria_id', session.ferreteriaId)
    .order('nombre')

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-[calc(100vh-theme(spacing.20))] flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center">
            <Target className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">CRM Pipeline</h1>
            <p className="text-sm text-zinc-500">Gestión de Oportunidades y Negocios</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <CRMBoard 
          oportunidades={oportunidades || []} 
          clientes={clientesCombo || []}
          userId={session.userId} 
        />
      </div>
    </div>
  )
}
