// /dashboard/ventas — Cotizaciones · Pedidos · Pagos en una sola página con tabs
import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { FileText, ShoppingCart, CreditCard, TrendingUp, Wallet } from 'lucide-react'
import CotizacionesTable from '@/components/cotizaciones/CotizacionesTable'
import OrdersPremiumView from '@/components/orders/premium/OrdersPremiumView'
import PagosView, { type PagoItem } from '@/components/pagos/PagosView'
import CreditosTable from '@/components/creditos/CreditosTable'
import type { PermisoMap } from '@/lib/auth/permisos'
import { cn } from '@/lib/utils'

// Repositories
import { VentasRepository } from '@/lib/db/repositories/ventas'
import { CatalogRepository } from '@/lib/db/repositories/catalogo'
import { DeliveryRepository } from '@/lib/db/repositories/logistica'
import { FacturacionRepository } from '@/lib/db/repositories/facturacion'
import { tieneFacturacionActiva } from '@/lib/facturacion/lycet/credenciales'
import { getContextoSucursal } from '@/lib/sucursales/contexto'

export const dynamic = 'force-dynamic'

const TABS = [
  { id: 'pedidos',      label: 'Pedidos',      icon: ShoppingCart },
  { id: 'cotizaciones', label: 'Cotizaciones',  icon: FileText     },
  { id: 'pagos',        label: 'Pagos',         icon: CreditCard   },
  { id: 'deudas',       label: 'Deudas',        icon: Wallet       },
] as const

type Tab = typeof TABS[number]['id']

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; estado?: string; pedido_id?: string; cotizacion_id?: string; pago_id?: string }>
}) {
  const params = await searchParams
  const tab: Tab = (params.tab as Tab) ?? 'pedidos'
  const initEstado = params.estado
  const initPedidoId = params.pedido_id
  const initCotizacionId = params.cotizacion_id
  const initPagoId = params.pago_id

  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()
  const ventasRepo = new VentasRepository(supabase)
  const catalogRepo = new CatalogRepository(supabase)
  const deliveryRepo = new DeliveryRepository(supabase)
  const facturacionRepo = new FacturacionRepository(supabase)

  // Resolver sucursal activa del usuario (null = "Todas" = sin filtro)
  const contextoSucursal = session.multiSucursal
    ? await getContextoSucursal(supabase, session)
    : null
  const localActivoId = contextoSucursal?.localActivoId ?? null

  // Conteo de deudas vencidas — siempre, para mostrar badge en el tab
  const { count: deudasVencidas } = await supabase
    .from('creditos')
    .select('id', { count: 'exact', head: true })
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('estado', 'vencido')

  // ── Pedidos (default) ────────────────────────────────────────────────────
  let pedidosContent: React.ReactNode = null
  if (tab === 'pedidos') {
    const [
      pedidos,
      productos,
      zonas,
      repartidores,
      ferreteriaData,
      facturacionConfigurada,
      localesReq
    ] = await Promise.all([
      ventasRepo.obtenerPedidosDashboard(session.ferreteriaId, localActivoId),
      catalogRepo.listarProductosActivos(session.ferreteriaId),
      deliveryRepo.listarZonasDelivery(session.ferreteriaId),
      deliveryRepo.listarRepartidores(session.ferreteriaId),
      facturacionRepo.obtenerDatosFerreteriaDashboard(session.ferreteriaId),
      tieneFacturacionActiva(supabase, session.ferreteriaId),
      session.multiSucursal ? supabase.from('locales_ferreteria').select('*').eq('ferreteria_id', session.ferreteriaId).eq('activo', true) : Promise.resolve({ data: [] }),
    ])

    pedidosContent = (
      <OrdersPremiumView
        pedidos={pedidos as any[] ?? []}
        productos={productos as any[] ?? []}
        zonas={zonas as any[] ?? []}
        locales={localesReq.data ?? []}
        ferreteriaId={session.ferreteriaId}
        rol={session.rol}
        repartidores={repartidores as any[] ?? []}
        permisos={session.permisos as PermisoMap}
        facturacionConfigurada={facturacionConfigurada}
        tieneRuc={ferreteriaData?.tipo_ruc !== 'sin_ruc'}
        initEstado={initEstado}
        initPedidoId={initPedidoId}
      />
    )
  }

  // ── Cotizaciones ─────────────────────────────────────────────────────────
  let cotizacionesContent: React.ReactNode = null
  if (tab === 'cotizaciones') {
    const [
      cotizaciones,
      configBot,
      productos
    ] = await Promise.all([
      ventasRepo.obtenerCotizacionesDashboard(session.ferreteriaId, localActivoId),
      catalogRepo.obtenerConfiguracionBot(session.ferreteriaId),
      catalogRepo.listarProductosActivos(session.ferreteriaId),
    ])

    const lista = (cotizaciones ?? []).map((c) => ({
      ...c,
      clientes: Array.isArray(c.clientes) ? c.clientes[0] ?? null : c.clientes,
    })) as Parameters<typeof CotizacionesTable>[0]['cotizaciones']

    cotizacionesContent = (
      <CotizacionesTable
        cotizaciones={lista}
        productos={productos as any[] ?? []}
        margenMinimo={configBot?.margen_minimo_porcentaje ?? 10}
        initCotizacionId={initCotizacionId}
      />
    )
  }

  // ── Deudas (Créditos) ────────────────────────────────────────────────────
  let deudasContent: React.ReactNode = null
  if (tab === 'deudas') {
    const creditos = await ventasRepo.listarCreditosDashboard(session.ferreteriaId, localActivoId)

    const totalActivo  = creditos.filter(c => c.estado === 'activo').reduce((s, c) => s + (c.monto_total - c.monto_pagado), 0)
    const totalVencido = creditos.filter(c => c.estado === 'vencido').reduce((s, c) => s + (c.monto_total - c.monto_pagado), 0)

    deudasContent = (
      <>
        {creditos.length === 0 ? (
          <div className="text-center py-16">
            <Wallet className="w-10 h-10 mx-auto mb-3 text-zinc-200" />
            <p className="text-sm text-zinc-500">No hay créditos registrados</p>
            <p className="text-xs text-zinc-400 mt-1">Los créditos a clientes aparecerán aquí. Se crean automáticamente cuando el bot registra una venta con pago pendiente.</p>
          </div>
        ) : (
          <>
            {/* Banner resumen de cartera */}
            {(totalActivo > 0 || totalVencido > 0) && (
              <div className="flex gap-3 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <Wallet className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">Cartera de deudas pendientes</p>
                  <div className="flex gap-4 mt-1 flex-wrap">
                    {totalActivo > 0 && (
                      <span className="text-xs text-amber-700">
                        <span className="font-bold">S/ {totalActivo.toFixed(2)}</span> activo
                      </span>
                    )}
                    {totalVencido > 0 && (
                      <span className="text-xs text-red-700">
                        <span className="font-bold">S/ {totalVencido.toFixed(2)}</span> vencido ⚠️
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            <CreditosTable
              creditos={creditos as any[]}
              rol={session.rol}
              permisos={session.permisos as PermisoMap}
            />
          </>
        )}
      </>
    )
  }

  // ── Pagos ────────────────────────────────────────────────────────────────
  let pagosContent: React.ReactNode = null
  if (tab === 'pagos') {
    const pagos = await ventasRepo.obtenerPagosDashboard(session.ferreteriaId, localActivoId)

    const porEstado = (pagos ?? []).reduce<Record<string, number>>((acc, p) => {
      acc[p.estado] = (acc[p.estado] ?? 0) + 1
      return acc
    }, {})

    pagosContent = (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { key: 'confirmado_auto',    label: 'Confirmados',     color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
            { key: 'pendiente_revision', label: 'Por revisar',     color: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
            { key: 'a_favor',            label: 'Crédito a favor', color: 'bg-blue-50 text-blue-700 border-blue-100' },
            { key: 'rechazado',          label: 'Rechazados',      color: 'bg-red-50 text-red-700 border-red-100' },
          ].map(({ key, label, color }) => (
            <div key={key} className={`rounded-2xl border p-4 ${color}`}>
              <p className="text-2xl font-bold tabular-nums">{porEstado[key] ?? 0}</p>
              <p className="text-xs font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <PagosView
          pagos={(pagos ?? []) as unknown as PagoItem[]}
          esDueno={session.rol === 'dueno'}
          initPagoId={initPagoId}
        />
      </>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-zinc-100 border border-zinc-200 rounded-2xl flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-zinc-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-950 tracking-tight">Ventas</h1>
          <p className="text-xs text-zinc-400">Pedidos, cotizaciones y pagos de tu negocio</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`/dashboard/ventas?tab=${id}`}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              tab === id
                ? 'border-zinc-950 text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {id === 'deudas' && (deudasVencidas ?? 0) > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">
                {deudasVencidas}
              </span>
            )}
          </a>
        ))}
      </div>

      {/* Contenido del tab activo */}
      {pedidosContent}
      {cotizacionesContent}
      {pagosContent}
      {deudasContent}
    </div>
  )
}
