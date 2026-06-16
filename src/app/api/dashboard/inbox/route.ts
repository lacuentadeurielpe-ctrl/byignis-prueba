import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const fid = session.ferreteriaId

  try {
    const alerts: any[] = []

    // 1. Check pending orders older than 48h
    const hace48Horas = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { count: pedidosRetrasados } = await supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('ferreteria_id', fid)
      .eq('estado', 'pendiente')
      .lte('created_at', hace48Horas)

    if (pedidosRetrasados && pedidosRetrasados > 0) {
      alerts.push({
        id: 'pedidos_retrasados',
        type: 'warning',
        title: 'Pedidos estancados',
        description: `Tienes ${pedidosRetrasados} pedido(s) en estado Pendiente por más de 48 horas.`,
        actionText: 'Revisar pedidos',
        href: '/dashboard/ventas?tab=pedidos&estado=pendiente',
      })
    }

    // 2. Check configuration (e.g. metodos de pago, facturacion)
    const { data: config } = await supabase
      .from('ferreterias')
      .select('tipo_ruc, nubefact_token_enc')
      .eq('id', fid)
      .single()

    if (config) {
      // Si tiene RUC configurado pero no tiene token de NubeFact, podría sugerirse
      if (config.tipo_ruc && config.tipo_ruc !== 'sin_ruc' && !config.nubefact_token_enc) {
        alerts.push({
          id: 'config_nubefact',
          type: 'info',
          title: 'Facturación Electrónica inactiva',
          description: 'Tienes un RUC registrado, pero falta vincular NubeFact para emitir boletas/facturas automáticamente.',
          actionText: 'Configurar NubeFact',
          href: '/dashboard/settings-2/finanzas',
        })
      }
    }

    // 3. Pagos pendientes de revisión older than 24h
    const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: pagosPendientes } = await supabase
      .from('pagos_registrados')
      .select('id', { count: 'exact', head: true })
      .eq('ferreteria_id', fid)
      .eq('estado', 'pendiente_revision')
      .lte('registrado_at', hace24Horas)

    if (pagosPendientes && pagosPendientes > 0) {
      alerts.push({
        id: 'pagos_retrasados',
        type: 'warning',
        title: 'Pagos por revisar',
        description: `Hay ${pagosPendientes} pago(s) esperando confirmación manual desde hace más de 24 horas.`,
        actionText: 'Revisar pagos',
        href: '/dashboard/ventas?tab=pagos&estado=pendiente_revision',
      })
    }

    return NextResponse.json({ alerts })
  } catch (err) {
    console.error('Error en /api/dashboard/inbox:', err)
    return NextResponse.json({ error: 'Error cargando inbox' }, { status: 500 })
  }
}
