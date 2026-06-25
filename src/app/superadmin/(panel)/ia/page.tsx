// /superadmin/ia — Gestión económica IA: consumo, tarifas, precios a tenants, facturas

import { createAdminClient } from '@/lib/supabase/admin'
import { inicioDiaLima }     from '@/lib/tiempo'
import IAPanel               from './IAPanel'

export const dynamic = 'force-dynamic'

async function getIAStats() {
  const admin       = createAdminClient()
  const horaInicio30d = inicioDiaLima(-30)

  const [{ data: movimientos30d }, { data: topConsumidores }] = await Promise.all([
    admin
      .from('movimientos_creditos')
      .select('tipo_tarea, modelo_usado, creditos_usados, costo_usd, created_at, ferreteria_id')
      .gte('created_at', horaInicio30d)
      .order('created_at', { ascending: false }),
    admin
      .from('movimientos_creditos')
      .select('ferreteria_id, creditos_usados, ferreterias(nombre)')
      .gte('created_at', horaInicio30d),
  ])

  const movs = movimientos30d ?? []
  const tops = topConsumidores ?? []

  // Por modelo
  const porModelo: Record<string, { llamadas: number; creditos: number; costoUsd: number }> = {}
  for (const m of movs) {
    const modelo = m.modelo_usado ?? 'desconocido'
    if (!porModelo[modelo]) porModelo[modelo] = { llamadas: 0, creditos: 0, costoUsd: 0 }
    porModelo[modelo].llamadas++
    porModelo[modelo].creditos += m.creditos_usados ?? 0
    porModelo[modelo].costoUsd += Number(m.costo_usd ?? 0)
  }

  // Por tarea
  const porTarea: Record<string, number> = {}
  for (const m of movs) {
    const t = m.tipo_tarea ?? 'desconocido'
    porTarea[t] = (porTarea[t] ?? 0) + (m.creditos_usados ?? 0)
  }

  // Top tenants
  const consumoPorTenant: Record<string, { nombre: string; creditos: number }> = {}
  for (const m of tops) {
    const fid    = m.ferreteria_id
    const nombre = (m as any).ferreterias?.nombre ?? fid
    if (!consumoPorTenant[fid]) consumoPorTenant[fid] = { nombre, creditos: 0 }
    consumoPorTenant[fid].creditos += m.creditos_usados ?? 0
  }
  const topTenants = Object.entries(consumoPorTenant)
    .sort((a, b) => b[1].creditos - a[1].creditos)
    .slice(0, 10)

  const totalCreditos = movs.reduce((s, m) => s + (m.creditos_usados ?? 0), 0)
  const totalCostoUsd = movs.reduce((s, m) => s + Number(m.costo_usd ?? 0), 0)
  const totalLlamadas = movs.length

  return { porModelo, porTarea, topTenants, totalCreditos, totalCostoUsd, totalLlamadas }
}

export default async function IAPage() {
  const stats = await getIAStats()
  return <IAPanel stats={stats} />
}
