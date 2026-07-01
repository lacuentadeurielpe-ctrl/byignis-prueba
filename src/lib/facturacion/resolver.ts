// Resuelve el proveedor de facturación activo para una ferretería.
// Leer proveedor_facturacion de ferreterias y devolver el adapter correcto.

import { NubefactAdapter }      from './nubefact-adapter'
import { SunatDirectoAdapter }  from './sunat-directo-adapter'
import type { ProveedorFacturacion } from './types'

export async function resolverProveedor(
  supabase: any,
  ferreteriaId: string
): Promise<ProveedorFacturacion> {
  const { data } = await supabase
    .from('ferreterias')
    .select('proveedor_facturacion')
    .eq('id', ferreteriaId)
    .single()

  const proveedor = data?.proveedor_facturacion ?? 'nubefact'

  if (proveedor === 'sunat_directo') {
    return new SunatDirectoAdapter()
  }

  // Fallback seguro: Nubefact (que devuelve error descriptivo si no está configurado)
  return new NubefactAdapter()
}
