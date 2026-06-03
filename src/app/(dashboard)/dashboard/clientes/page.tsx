// Lista de clientes con métricas resumidas + nuevos campos de identificación
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { Users, UserPlus, GitMerge } from 'lucide-react'
import ClientesTable from '@/components/clientes/ClientesTable'
import ClientesDashboardMetrics from '@/components/clientes/ClientesDashboardMetrics'
import ClientesPageActions from '@/components/clientes/ClientesPageActions'
import { ClientesRepository } from '@/lib/db/repositories/clientes'

export const dynamic = 'force-dynamic'

export default async function ClientesPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()
  const clientesRepo = new ClientesRepository(supabase)

  // Clientes con métricas + todos los campos de identificación
  // ferreteria_id filtrado → aislamiento multi-tenancy garantizado a través de capa de repositorio
  const clientes = await clientesRepo.obtenerClientesConResumen(session.ferreteriaId)

  // Calcular métricas por cliente
  const clientesConMetricas = (clientes ?? []).map((c) => {
    const pedidos = (c.pedidos ?? []) as Array<{ id: string; total: number; estado: string; created_at: string }>
    const pedidosCompletados = pedidos.filter(p => p.estado !== 'cancelado')
    const totalGastado = pedidosCompletados.reduce((s, p) => s + (p.total ?? 0), 0)
    const ultimoPedido = pedidos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    const creditos = (c.creditos ?? []) as Array<{ monto_total: number; monto_pagado: number; estado: string }>
    const deuda = creditos.reduce((s, cr) => s + (cr.monto_total - cr.monto_pagado), 0)

    return {
      id: c.id,
      nombre: c.nombre ?? null,
      telefono: c.telefono ?? null,
      dni_ruc: (c as any).dni_ruc ?? null,
      tipo: ((c as any).tipo ?? 'persona') as 'persona' | 'empresa' | 'anonimo',
      alias: (c as any).alias ?? null,
      email: (c as any).email ?? null,
      telefono_secundario: (c as any).telefono_secundario ?? null,
      direccion_habitual: (c as any).direccion_habitual ?? null,
      tags: (c as any).tags ?? [],
      notas_internas: (c as any).notas_internas ?? null,
      created_at: c.created_at,
      totalPedidos: pedidos.length,
      pedidosCompletados: pedidosCompletados.length,
      totalGastado,
      deuda,
      ultimoPedido: ultimoPedido?.created_at ?? null,
    }
  }).sort((a, b) => b.totalGastado - a.totalGastado)

  // Calcular métricas globales
  const totalClientes = clientesConMetricas.length
  const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const clientesActivos30Dias = clientesConMetricas.filter(c => c.ultimoPedido && c.ultimoPedido >= hace30dias).length
  const deudaTotal = clientesConMetricas.reduce((s, c) => s + c.deuda, 0)
  const topComprador = clientesConMetricas[0]?.totalGastado > 0
    ? { nombre: clientesConMetricas[0].nombre || clientesConMetricas[0].alias || 'Sin nombre', total: clientesConMetricas[0].totalGastado }
    : null

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-zinc-100 border border-zinc-200 rounded-2xl flex items-center justify-center">
            <Users className="w-4 h-4 text-zinc-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-950 tracking-tight">CRM Clientes</h1>
            <p className="text-xs text-zinc-400">Gestión de cartera y cuentas corrientes</p>
          </div>
        </div>
        <ClientesPageActions
          esVendedor={session.rol === 'vendedor'}
          clientes={clientesConMetricas}
        />
      </div>

      <ClientesDashboardMetrics
        totalClientes={totalClientes}
        clientesActivos30Dias={clientesActivos30Dias}
        deudaTotal={deudaTotal}
        topComprador={topComprador}
      />

      <ClientesTable
        clientes={clientesConMetricas}
        esVendedor={session.rol === 'vendedor'}
      />
    </div>
  )
}
