'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSWRConfig } from 'swr'

export default function DashboardRealtime({ ferreteriaId }: { ferreteriaId: string }) {
  const { mutate } = useSWRConfig()

  useEffect(() => {
    if (!ferreteriaId) return

    const supabase = createClient()

    // Función que obliga a SWR a revalidar silenciosamente todos los endpoints del dashboard
    const revalidateDashboard = () => {
      mutate('/api/dashboard/snapshot')
      // Muta cualquier key que empiece con kpi (ej. /api/dashboard/kpi?p=hoy)
      mutate((key) => typeof key === 'string' && key.startsWith('/api/dashboard/kpi'))
      mutate('/api/dashboard/pipeline')
      mutate('/api/dashboard/feed')
      mutate('/api/dashboard/charts')
    }

    // Nos suscribimos a eventos globales en la base de datos para esta ferretería
    const channel = supabase
      .channel('dashboard-realtime')
      // Cuando entre un pedido nuevo o cambie de estado
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `ferreteria_id=eq.${ferreteriaId}` }, revalidateDashboard)
      // Cuando se registre un pago (para los cobros pendientes)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos', filter: `ferreteria_id=eq.${ferreteriaId}` }, revalidateDashboard)
      // Cuando se emita una boleta/factura
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comprobantes', filter: `ferreteria_id=eq.${ferreteriaId}` }, revalidateDashboard)
      // Cuando se pause/active un chat
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones', filter: `ferreteria_id=eq.${ferreteriaId}` }, revalidateDashboard)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Dashboard Realtime] Suscrito a eventos de ventas en vivo.')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ferreteriaId, mutate])

  // Este componente no renderiza nada visual, solo funciona como motor en segundo plano.
  return null
}
