// Utilidad server-side para obtener el rol y permisos del usuario actual
import { createClient } from '@/lib/supabase/server'
import { type PermisoMap, PERMISOS_DUENO, normalizarPermisos } from '@/lib/auth/permisos'

export type Rol = 'dueno' | 'vendedor'

export interface SessionInfo {
  userId: string
  ferreteriaId: string
  rol: Rol
  nombreFerreteria: string
  onboardingCompleto: boolean
  permisos: PermisoMap
  /** Flag multi-sucursal del tenant (migración 106). */
  multiSucursal: boolean
  /** Sucursal fija del empleado (miembros_ferreteria.local_id). null = todas. */
  localAsignadoId: string | null
}

/**
 * Obtiene la ferretería, el rol y los permisos del usuario autenticado.
 * - Dueño: todos los permisos en true automáticamente.
 * - Empleado: permisos del campo `permisos JSONB` en miembros_ferreteria.
 * React/Next.js deduplica esta llamada dentro del mismo request.
 */
export async function getSessionInfo(): Promise<SessionInfo | null> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) return null
  const user = session.user

  // 1. ¿Es dueño?
  const { data: ferreteria } = await supabase
    .from('ferreterias')
    .select('id, nombre, onboarding_completo, multi_sucursal')
    .eq('owner_id', session.user.id)
    .single()

  if (ferreteria) {
    return {
      userId: user.id,
      ferreteriaId: ferreteria.id,
      rol: 'dueno',
      nombreFerreteria: ferreteria.nombre,
      onboardingCompleto: ferreteria.onboarding_completo ?? false,
      permisos: PERMISOS_DUENO,
      multiSucursal: ferreteria.multi_sucursal ?? false,
      localAsignadoId: null, // el dueño nunca está fijado a una sucursal
    }
  }

  // 2. ¿Es empleado invitado?
  const { data: miembro } = await supabase
    .from('miembros_ferreteria')
    .select('ferreteria_id, rol, nombre, permisos, local_id, ferreterias(id, nombre, onboarding_completo, multi_sucursal)')
    .eq('user_id', user.id)
    .eq('activo', true)
    .single()

  if (miembro) {
    const ferr = miembro.ferreterias as any
    return {
      userId: user.id,
      ferreteriaId: miembro.ferreteria_id,
      rol: miembro.rol as Rol,
      nombreFerreteria: ferr?.nombre ?? 'Ferretería',
      onboardingCompleto: ferr?.onboarding_completo ?? true,
      permisos: normalizarPermisos((miembro.permisos as Record<string, unknown>) ?? {}),
      multiSucursal: ferr?.multi_sucursal ?? false,
      localAsignadoId: miembro.local_id ?? null,
    }
  }

  return null
}
