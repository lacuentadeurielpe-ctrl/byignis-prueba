import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { getSessionInfo } from '@/lib/auth/roles'
import { getDB } from '@/lib/db'
import ComprasTable from '@/components/contabilidad/ComprasTable'

export const dynamic = 'force-dynamic'

export default async function ComprasPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')
  if (session.rol !== 'dueno') redirect('/dashboard')

  const db = await getDB()
  const compras = await db.compras.listarCompras(session.ferreteriaId)

  // Adapt database rows to type expected by ComprasTable
  const comprasAdaptadas = (compras ?? []).map((c: any) => ({
    id: c.id,
    numero_compra: c.numero_compra,
    tipo: c.tipo,
    proveedor_nombre: c.proveedor_nombre,
    numero_factura: c.numero_factura,
    fecha_factura: c.fecha_factura,
    total_neto: Number(c.total_neto),
    estado: c.estado,
    created_at: c.created_at
  }))

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/finanzas?tab=contabilidad"
            className="w-9 h-9 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-center transition"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-600" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-zinc-100 border border-zinc-200 rounded-xl flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-zinc-700" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-950 tracking-tight">Registro de Compras</h1>
              <p className="text-xs text-zinc-400">Historial y control de stock de compras a proveedores</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-50 rounded-2xl border border-zinc-100 p-6 space-y-4">
        <ComprasTable comprasIniciales={comprasAdaptadas} ferreteriaId={session.ferreteriaId} />
      </div>
    </div>
  )
}
