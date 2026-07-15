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
  const { data: ferreteria, error: errorDueno } = await supabase
    .from('ferreterias')
    .select('id, nombre, onboarding_completo, multi_sucursal')
    .eq('owner_id', session.user.id)
    .single()

  if (errorDueno && errorDueno.code !== 'PGRST116') {
    console.error('Error fetching ferreteria:', errorDueno)
  }

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
  // PGRST116 = Supabase .single() falla cuando hay 0 filas ("no rows") o >1 fila ("multiple rows").
  // Distinguimos el caso de múltiples filas por el mensaje de error y activamos
  // un fallback que toma el registro más antiguo activo, de modo que el usuario
  // no quede bloqueado mientras se aplica la migración 116 en la BD.
  const { data: miembro, error: errorMiembro } = await supabase
    .from('miembros_ferreteria')
    .select('ferreteria_id, rol, nombre, permisos, local_id, ferreterias(id, nombre, onboarding_completo, multi_sucursal)')
    .eq('user_id', user.id)
    .eq('activo', true)
    .single()

  let finalMiembro = miembro
  if (errorMiembro) {
    const esMultiplesFilas = errorMiembro.code === 'PGRST116' &&
      (errorMiembro.message?.toLowerCase().includes('multiple') ||
       errorMiembro.details?.toLowerCase().includes('more than one'))

    if (esMultiplesFilas) {
      // Duplicados en miembros_ferreteria — activar fallback temporal.
      // La migración 116 limpia los duplicados en la BD.
      console.error(
        `[AUTH] getSessionInfo: múltiples filas activas en miembros_ferreteria ` +
        `para user_id=${user.id}. ` +
        `Error: ${errorMiembro.code} — ${errorMiembro.message}. ` +
        `ACCIÓN REQUERIDA: aplicar migración 116_fix_duplicados_miembros_constraints.sql`
      )
      const { data: listaMiembros } = await supabase
        .from('miembros_ferreteria')
        .select('ferreteria_id, rol, nombre, permisos, local_id, ferreterias(id, nombre, onboarding_completo, multi_sucursal)')
        .eq('user_id', user.id)
        .eq('activo', true)
        .order('created_at', { ascending: true })
        .limit(1)
      finalMiembro = listaMiembros?.[0] ?? null
      if (finalMiembro) {
        console.warn(
          `[AUTH] Fallback activado: usando ferreteria_id=${finalMiembro.ferreteria_id} ` +
          `(registro más antiguo activo). Usuario operativo en estado degradado.`
        )
      }
    } else if (errorMiembro.code !== 'PGRST116') {
      // Error inesperado (no es "0 filas" ni "múltiples filas")
      console.error(`[AUTH] Error inesperado al cargar miembros_ferreteria para user_id=${user.id}:`, errorMiembro)
    }
  }

  if (finalMiembro) {
    const ferr = finalMiembro.ferreterias as any
    return {
      userId: user.id,
      ferreteriaId: finalMiembro.ferreteria_id,
      rol: finalMiembro.rol as Rol,
      nombreFerreteria: ferr?.nombre ?? 'Ferretería',
      onboardingCompleto: ferr?.onboarding_completo ?? true,
      permisos: normalizarPermisos((finalMiembro.permisos as Record<string, unknown>) ?? {}),
      multiSucursal: ferr?.multi_sucursal ?? false,
      localAsignadoId: finalMiembro.local_id ?? null,
    }
  }

  return null
}
