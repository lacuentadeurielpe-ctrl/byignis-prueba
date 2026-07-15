// Capa de acceso modular por sucursal.
// Controla qué módulos del menú están disponibles para la sucursal activa.
//
// ARQUITECTURA:
//   HOY  → siempre retorna true (sin restricciones por sucursal).
//   FUTURO → consultará localActivoId contra una tabla `sucursal_modulos`
//             o un mapa de configuración, permitiendo restringir módulos
//             por sucursal sin tocar el resto del sistema.
//
// Para restringir un módulo en el futuro:
//   1. Crear tabla `sucursal_modulos (local_id, modulo, habilitado)`.
//   2. Cargar esa config en `getContextoSucursal` y añadirla al tipo ContextoSucursal.
//   3. Reemplazar el `return true` del bloque multi-sucursal con la consulta real.

import type { ModuleName } from '@/lib/config/modules'
import type { ContextoSucursal } from '@/lib/sucursales/contexto'

/**
 * Verifica si un módulo está disponible para la sucursal activa del usuario.
 *
 * @param modulo    - Nombre del módulo a verificar (mismo tipo que ModuleName).
 * @param contexto  - Contexto de sucursal del usuario. null = tienda sin contexto.
 * @returns true si el módulo debe mostrarse/usarse; false para ocultarlo.
 */
export function isModuleEnabledForSucursal(
  modulo: ModuleName,
  contexto: ContextoSucursal | null,
): boolean {
  // Sin contexto resuelto: acceso total (fallback seguro).
  if (!contexto) return true

  // Tienda única: todos los módulos siempre disponibles.
  if (!contexto.multiSucursal) return true

  // Multi-sucursal: hoy todos los módulos están disponibles para todas las sucursales.
  // HOOK FUTURO: reemplazar este `return true` con la consulta a `contexto.modulosLocales`
  // (campo que se añadirá a ContextoSucursal cuando se implemente la restricción granular).
  //
  // Ejemplo futuro:
  //   const modulos = contexto.modulosLocales ?? {}
  //   return modulos[modulo] !== false
  return true
}
