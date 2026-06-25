import type { SupabaseClient } from '@supabase/supabase-js'
import { CatalogRepository } from './repositories/catalogo'
import { ChatRepository } from './repositories/chat'
import { ClientesRepository } from './repositories/clientes'
import { FacturacionRepository } from './repositories/facturacion'
import { FinanzasRepository } from './repositories/finanzas'
import { DeliveryRepository } from './repositories/logistica'
import { ProveedorRepository } from './repositories/proveedores'
import { SaasRepository } from './repositories/saas'
import { VentasRepository } from './repositories/ventas'
import { ComprasRepository } from './repositories/compras'


export class RepositoryManager {
  public catalog: CatalogRepository
  public chat: ChatRepository
  public clientes: ClientesRepository
  public facturacion: FacturacionRepository
  public finanzas: FinanzasRepository
  public logistica: DeliveryRepository
  public proveedores: ProveedorRepository
  public saas: SaasRepository
  public ventas: VentasRepository
  public compras: ComprasRepository

  constructor(supabase: SupabaseClient) {
    this.catalog = new CatalogRepository(supabase)
    this.chat = new ChatRepository(supabase)
    this.clientes = new ClientesRepository(supabase)
    this.facturacion = new FacturacionRepository(supabase)
    this.finanzas = new FinanzasRepository(supabase)
    this.logistica = new DeliveryRepository(supabase)
    this.proveedores = new ProveedorRepository(supabase)
    this.saas = new SaasRepository(supabase)
    this.ventas = new VentasRepository(supabase)
    this.compras = new ComprasRepository(supabase)
  }
}

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Obtiene el RepositoryManager para uso del lado del servidor (server-side, SSR, API routes).
 */
export async function getDB(): Promise<RepositoryManager> {
  const supabase = await createServerClient()
  return new RepositoryManager(supabase)
}

/**
 * Obtiene el RepositoryManager para uso del navegador (client-side components).
 */
export function getBrowserDB(): RepositoryManager {
  const supabase = createBrowserClient()
  return new RepositoryManager(supabase)
}

/**
 * Obtiene el RepositoryManager utilizando el service role (bypassea RLS).
 * SOLO para uso en servidor.
 */
export function getAdminDB(): RepositoryManager {
  const supabase = createAdminClient()
  return new RepositoryManager(supabase)
}
