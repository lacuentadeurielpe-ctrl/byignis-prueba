// Utilidad server-side para obtener el rol y permisos del usuario actual
import { unstable_noStore as noStore } from 'next/cache'
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
  /** Estado de la suscripción (activo, suspendido, etc). */
  estadoSuscripcion: string
  /** true si puede usar el sistema: estado 'activo' o trial de 3 días vigente. */
  suscripcionActiva: boolean
  /** Días restantes del trial (solo cuando estado === 'trial'). */
  trialDiasRestantes: number | null
  /** ID del plan activo. */
  planId?: string | null
}

/** Fecha actual en Lima como YYYY-MM-DD (las fechas de ciclo son DATE). */
function hoyLima(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}

/**
 * Evalúa si la suscripción da acceso al sistema.
 * - 'activo' (pro/vitalicio, lo gestiona el superadmin o el webhook de MP) → sí.
 * - 'trial' → sí mientras ciclo_fin no haya pasado (prueba gratis de 3 días).
 * - resto ('suspendido', 'vencido' o sin fila) → no, va al paywall.
 */
function evaluarSuscripcion(
  estado: string,
  cicloFin: string | null
): { activa: boolean; trialDiasRestantes: number | null } {
  if (estado === 'activo') return { activa: true, trialDiasRestantes: null }
  if (estado === 'trial') {
    if (!cicloFin) return { activa: false, trialDiasRestantes: 0 }
    const hoy = hoyLima()
    const dias = Math.max(
      0,
      Math.ceil((new Date(cicloFin).getTime() - new Date(hoy).getTime()) / 86_400_000)
    )
    return { activa: cicloFin >= hoy, trialDiasRestantes: dias }
  }
  return { activa: false, trialDiasRestantes: null }
}

/**
 * Obtiene la ferretería, el rol y los permisos del usuario autenticado.
 * - Dueño: todos los permisos en true automáticamente.
 * - Empleado: permisos del campo `permisos JSONB` en miembros_ferreteria.
 * React/Next.js deduplica esta llamada dentro del mismo request.
 */
export async function getSessionInfo(): Promise<SessionInfo | null> {
  noStore()
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) return null
  const user = session.user

  // 1. ¿Es dueño?
  const { data: ferreteria } = await supabase
    .from('ferreterias')
    .select('id, nombre, onboarding_completo, multi_sucursal, suscripciones(estado, plan_id, ciclo_fin)')
    .eq('owner_id', session.user.id)
    .single()

  if (ferreteria) {
    const suscripcion = Array.isArray(ferreteria.suscripciones)
      ? ferreteria.suscripciones[0]
      : (ferreteria.suscripciones as any)

    const estado = suscripcion?.estado ?? 'suspendido'
    const planId = suscripcion?.plan_id ?? null
    const evalSub = evaluarSuscripcion(estado, suscripcion?.ciclo_fin ?? null)

    return {
      userId: user.id,
      ferreteriaId: ferreteria.id,
      rol: 'dueno',
      nombreFerreteria: ferreteria.nombre,
      onboardingCompleto: ferreteria.onboarding_completo ?? false,
      permisos: PERMISOS_DUENO,
      multiSucursal: ferreteria.multi_sucursal ?? false,
      localAsignadoId: null, // el dueño nunca está fijado a una sucursal
      estadoSuscripcion: estado,
      suscripcionActiva: evalSub.activa,
      trialDiasRestantes: evalSub.trialDiasRestantes,
      planId,
    }
  }

  // 2. ¿Es empleado invitado?
  const { data: miembro } = await supabase
    .from('miembros_ferreteria')
    .select('ferreteria_id, rol, nombre, permisos, local_id, ferreterias(id, nombre, onboarding_completo, multi_sucursal, suscripciones(estado, plan_id, ciclo_fin))')
    .eq('user_id', user.id)
    .eq('activo', true)
    .single()

  if (miembro) {
    const ferr = miembro.ferreterias as any
    const suscripcion = Array.isArray(ferr?.suscripciones)
      ? ferr?.suscripciones[0]
      : ferr?.suscripciones
      
    const estado = suscripcion?.estado ?? 'suspendido'
    const planId = suscripcion?.plan_id ?? null
    const evalSub = evaluarSuscripcion(estado, suscripcion?.ciclo_fin ?? null)

    return {
      userId: user.id,
      ferreteriaId: miembro.ferreteria_id,
      rol: miembro.rol as Rol,
      nombreFerreteria: ferr?.nombre ?? 'Ferretería',
      onboardingCompleto: ferr?.onboarding_completo ?? true,
      permisos: normalizarPermisos((miembro.permisos as Record<string, unknown>) ?? {}),
      multiSucursal: ferr?.multi_sucursal ?? false,
      localAsignadoId: miembro.local_id ?? null,
      estadoSuscripcion: estado,
      suscripcionActiva: evalSub.activa,
      trialDiasRestantes: evalSub.trialDiasRestantes,
      planId,
    }
  }

  return null
}
