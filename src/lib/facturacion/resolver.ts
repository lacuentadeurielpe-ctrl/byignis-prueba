// Resuelve el proveedor de facturación activo para una ferretería.
// Desde la migración 102, SUNAT Directo es el único proveedor del sistema.
// Se mantiene la firma async (supabase, ferreteriaId) para que los llamadores
// no cambien y para poder reintroducir multi-proveedor sin tocarlos.

import { SunatDirectoAdapter } from './sunat-directo-adapter'
import type { ProveedorFacturacion } from './types'

export async function resolverProveedor(
  _supabase: any,
  _ferreteriaId: string
): Promise<ProveedorFacturacion> {
  return new SunatDirectoAdapter()
}
