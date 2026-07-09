import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { Building2, Users } from 'lucide-react'
import TeamOrganizer from '@/components/equipo/TeamOrganizer'
import type { Empleado, Local } from '@/components/equipo/TeamOrganizer'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Organización del Equipo' }

export default async function OrganizacionPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()

  // Cargar empleados y locales en paralelo
  const [{ data: empleadosData }, { data: localesData }, { data: asignacionesData }] = await Promise.all([
    supabase
      .from('miembros_ferreteria')
      .select('id, nombre, rol, activo, email, local_id')
      .eq('ferreteria_id', session.ferreteriaId)
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
      .eq('ferreteria_id', session.ferreteriaId)
  ])

  const asignaciones = asignacionesData ?? []
  
  const empleados: Empleado[] = (empleadosData ?? []).map(e => ({
    id: e.id,
    nombre: e.nombre ?? 'Sin nombre',
    rol: e.rol ?? 'vendedor',
    activo: e.activo ?? true,
    email: e.email,
    local_id: e.local_id ?? null,
    sucursales: asignaciones.filter(a => a.empleado_id === e.id).map(a => a.local_id),
  }))

  const locales: Local[] = (localesData ?? []).map(l => ({
    id: l.id,
    nombre: l.nombre,
    es_principal: l.es_principal ?? false,
  }))

  // Si no hay multi-sucursal activo, redirigir a equipo
  if (!session.multiSucursal || locales.length === 0) {
    redirect('/dashboard/equipo')
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Organización del Equipo</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Arrastra a los empleados hacia la sucursal donde trabajan.
            Los <strong>repartidores y administradores</strong> pueden aparecer en varias sucursales.
          </p>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 rounded-full border border-zinc-200">
          <Users className="w-3 h-3 text-zinc-400" />
          <span className="text-zinc-600 font-medium">{empleados.length} empleados</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 rounded-full border border-zinc-200">
          <Building2 className="w-3 h-3 text-zinc-400" />
          <span className="text-zinc-600 font-medium">{locales.length} sucursales</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 rounded-full border border-zinc-200">
          <span className="text-zinc-400">💡</span>
          <span className="text-zinc-500">Arrastra un chip para reasignar</span>
        </div>
      </div>

      {/* Organizador */}
      <TeamOrganizer empleados={empleados} locales={locales} />
    </div>
  )
}
