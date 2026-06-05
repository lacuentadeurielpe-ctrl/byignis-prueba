import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/auth/roles'
import CompraForm from '@/components/contabilidad/CompraForm'
import CatalogNav from '@/components/catalog/CatalogNav'
import { Bot } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CatalogScannerPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')
  if (session.rol !== 'dueno') redirect('/dashboard')

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto flex flex-col" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Header Catalog */}
      <div className="mb-1 shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-violet-100 border border-violet-200 rounded-2xl flex items-center justify-center">
            <Bot className="w-4.5 h-4.5 text-violet-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-950 tracking-tight">Escáner de Facturas IA</h1>
            <p className="text-xs text-zinc-400">Extrae productos y actualiza inventario automáticamente desde una foto</p>
          </div>
        </div>
        <CatalogNav />
      </div>

      <div className="flex-1 mt-2">
        <CompraForm />
      </div>
    </div>
  )
}
