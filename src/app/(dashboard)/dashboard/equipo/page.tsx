import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { Users } from 'lucide-react'
import EquipoTabs from '@/components/equipo/EquipoTabs'
import type { MiembroEquipo, LocalEquipo } from '@/components/equipo/roles/RolesBoard'
import { normalizarPermisos } from '@/lib/auth/permisos'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Equipo — Roles y Sucursales' }

export default async function EquipoPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()

  // Cargar miembros, locales y asignaciones en paralelo
  const [{ data: miembrosData }, { data: localesData }, { data: asignacionesData }] =
    await Promise.all([
      supabase
        .from('miembros_ferreteria')
        .select('id, nombre, rol, activo, email, local_id, permisos')
        .eq('ferreteria_id', session.ferreteriaId)
        .eq('activo', true)
        .order('nombre'),
      supabase
        .from('locales_ferreteria')
        .select('id, nombre, es_principal')
        .eq('ferreteria_id', session.ferreteriaId)
        .eq('activo', true)
        .order('es_principal', { ascending: false })
        .order('created_at', { ascending: true }),
      supabase
        .from('empleado_sucursal')
        .select('empleado_id, local_id')
        .eq('ferreteria_id', session.ferreteriaId),
    ])

  const asignaciones = asignacionesData ?? []

  const miembros: MiembroEquipo[] = (miembrosData ?? []).map(m => ({
    id: m.id,
    nombre: m.nombre ?? 'Sin nombre',
    rol: m.rol ?? 'vendedor',
    activo: m.activo ?? true,
    email: m.email,
    local_id: m.local_id ?? null,
    permisos: normalizarPermisos((m.permisos ?? {}) as Record<string, unknown>),
    // Sucursales vienen de la tabla pivot empleado_sucursal; fallback a local_id si no hay pivot
    sucursales: (() => {
      const pivot = asignaciones.filter(a => a.empleado_id === m.id).map(a => a.local_id)
      if (pivot.length > 0) return pivot
      return m.local_id ? [m.local_id] : []
    })(),
  }))

  // Si no hay locales, creamos un local "virtual" principal para tenants de sucursal única
  const locales: LocalEquipo[] = localesData && localesData.length > 0
    ? localesData.map(l => ({
        id: l.id,
        nombre: l.nombre,
        es_principal: l.es_principal ?? false,
      }))
    : [{
        id: 'principal',
        nombre: 'Local Principal',
        es_principal: true,
      }]

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Equipo</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {miembros.length} miembro{miembros.length !== 1 ? 's' : ''} · {localesData?.length ?? 0} sucursal{(localesData?.length ?? 0) !== 1 ? 'es' : ''}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <EquipoTabs miembros={miembros} locales={locales} />
    </div>
  )
}
