// Contexto de sucursal — ÚNICO lugar que decide "en qué local estoy operando".
// Plan: docs/PLAN_SUCURSALES.md — FASE 2.
//
// Reglas:
//  * ferreteria_id es la frontera de seguridad (RLS). local_id es autorización
//    de aplicación: NUNCA se confía en un local_id que venga del cliente sin
//    validarlo contra localesVisibles.
//  * Con multi_sucursal=false el contexto degrada a "local principal para
//    todo" y ningún flujo cambia.
//  * localActivoId === null para el dueño significa "Todas las sucursales"
//    (vista consolidada, solo lectura de listados).

import { cookies } from 'next/headers'
import type { SessionInfo } from '@/lib/auth/roles'

export const COOKIE_LOCAL_ACTIVO = 'local_activo'

export interface LocalVisible {
  id: string
  nombre: string
  codigo: string | null
  es_principal: boolean
  codigo_sunat: string
}

export interface ContextoSucursal {
  /** Flag del tenant. false = tienda única, todo lo demás degrada a principal. */
  multiSucursal: boolean
  /** Locales que el usuario puede ver/operar (dueño o miembro sin asignación: todos). */
  localesVisibles: LocalVisible[]
  /** Local sobre el que se está operando. null = "Todas" (solo dueño/sin asignación). */
  localActivoId: string | null
  /**
   * Local donde se ESCRIBE (ventas, caja, comprobantes).
   * null solo si el tenant no tiene ningún local creado (situación imposible
   * tras migración 106, pero tipada para que los consumidores lo manejen
   * explícitamente en lugar de recibir '' silenciosamente).
   */
  localEscrituraId: string | null
  /** true si el usuario está fijado a una sucursal (empleado asignado). */
  localFijado: boolean
}

/**
 * Resuelve el contexto de sucursal del usuario autenticado.
 * Orden de resolución del local activo:
 *   1. Asignación fija del empleado (miembros_ferreteria.local_id)
 *   2. Cookie `local_activo` (si apunta a un local visible)
 *   3. null ("Todas") para lecturas — el local de escritura cae al principal.
 */
export async function getContextoSucursal(
  supabase: any,
  session: Pick<SessionInfo, 'ferreteriaId' | 'rol'> & { localAsignadoId?: string | null },
): Promise<ContextoSucursal> {
  const [{ data: ferreteria }, { data: locales }] = await Promise.all([
    supabase.from('ferreterias').select('multi_sucursal').eq('id', session.ferreteriaId).single(),
    supabase
      .from('locales_ferreteria')
      .select('id, nombre, codigo, es_principal, codigo_sunat')
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('activo', true)
      .order('es_principal', { ascending: false })
      .order('created_at', { ascending: true }),
  ])

  const todos: LocalVisible[] = locales ?? []
  const principal = todos.find(l => l.es_principal) ?? todos[0] ?? null
  const multiSucursal = (ferreteria?.multi_sucursal ?? false) && todos.length > 0

  // Tienda única: el contexto degrada al principal, sin cookie ni asignaciones.
  // Siempre se resuelve (aunque multiSucursal sea false) para que localEscrituraId
  // quede correctamente asignado al local principal y los pedidos/comprobantes
  // no queden con local_id vacío.
  if (!multiSucursal) {
    return {
      multiSucursal: false,
      localesVisibles: principal ? [principal] : [],
      localActivoId: principal?.id ?? null,
      localEscrituraId: principal?.id ?? null,  // null si no hay local (caso imposible tras migración 106)
      localFijado: false,
    }
  }

  // Empleado fijado a una sucursal: solo ve y opera la suya.
  const asignado = session.localAsignadoId
    ? todos.find(l => l.id === session.localAsignadoId)
    : null
  if (asignado) {
    return {
      multiSucursal: true,
      localesVisibles: [asignado],
      localActivoId: asignado.id,
      localEscrituraId: asignado.id,
      localFijado: true,
    }
  }

  // Dueño (o miembro sin asignación): cookie decide; sin cookie = "Todas".
  const cookieStore = await cookies()
  const cookieLocal = cookieStore.get(COOKIE_LOCAL_ACTIVO)?.value ?? null
  const activo = cookieLocal ? todos.find(l => l.id === cookieLocal) ?? null : null

  return {
    multiSucursal: true,
    localesVisibles: todos,
    localActivoId: activo?.id ?? null,
    localEscrituraId: (activo ?? principal)?.id ?? null,
    localFijado: false,
  }
}

/** Valida que un local_id recibido del cliente sea operable por el usuario. */
export function validarLocalPermitido(
  contexto: ContextoSucursal,
  localId: string | null | undefined,
): boolean {
  if (localId == null) return true // null = principal/legado, siempre válido
  return contexto.localesVisibles.some(l => l.id === localId)
}
