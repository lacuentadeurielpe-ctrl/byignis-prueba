'use client'

// Sincroniza la lista de pedidos con la base de datos en vivo (Supabase Realtime).
//
// El payload de postgres_changes trae solo la fila cruda de `pedidos` (sin joins),
// así que ante INSERT/UPDATE se refetchea el pedido completo con las mismas
// relaciones que usa el server (VentasRepository.obtenerPedidosDashboard) para
// que la forma del objeto sea idéntica y ningún componente note la diferencia.
//
// RLS aplica también a Realtime: cada navegador solo recibe eventos de los
// pedidos de su propio negocio. El filtro por ferreteria_id es un refuerzo.

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// Mismo select que VentasRepository.obtenerPedidosDashboard
const SELECT_PEDIDO_COMPLETO =
  '*, clientes(nombre, telefono, dni_ruc), zonas_delivery(nombre), items_pedido(*), comprobantes(id, tipo, numero_completo, estado, pdf_url), metodo_pago, estado_pago, pago_confirmado_por, pago_confirmado_at'

interface PedidoMinimo {
  id: string
  numero_pedido?: string
}

export function useRealtimePedidos<T extends PedidoMinimo>(
  ferreteriaId: string | undefined,
  setPedidos: React.Dispatch<React.SetStateAction<T[]>>,
) {
  useEffect(() => {
    if (!ferreteriaId) return
    const supabase = createClient()

    async function fetchPedidoCompleto(id: string): Promise<T | null> {
      const { data } = await supabase
        .from('pedidos')
        .select(SELECT_PEDIDO_COMPLETO)
        .eq('id', id)
        .eq('ferreteria_id', ferreteriaId!)
        .single()
      return (data as T | null) ?? null
    }

    const channel = supabase
      .channel(`pedidos-rt-${ferreteriaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos', filter: `ferreteria_id=eq.${ferreteriaId}` },
        async (payload) => {
          const completo = await fetchPedidoCompleto((payload.new as { id: string }).id)
          if (!completo) return
          setPedidos(prev => {
            // El modal de creación ya lo insertó optimistamente → reemplazar, no duplicar
            if (prev.some(p => p.id === completo.id)) {
              return prev.map(p => (p.id === completo.id ? completo : p))
            }
            toast.info(`Nuevo pedido ${completo.numero_pedido ?? ''}`.trim())
            return [completo, ...prev]
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `ferreteria_id=eq.${ferreteriaId}` },
        async (payload) => {
          const completo = await fetchPedidoCompleto((payload.new as { id: string }).id)
          if (!completo) return
          setPedidos(prev => prev.map(p => (p.id === completo.id ? completo : p)))
        },
      )
      .on(
        'postgres_changes',
        // DELETE solo trae la PK y no admite filtro por columna — se remueve
        // de la lista local si estaba (si no, no-op). RLS no filtra deletes,
        // pero un UUID ajeno simplemente no matchea nada aquí.
        { event: 'DELETE', schema: 'public', table: 'pedidos' },
        (payload) => {
          const id = (payload.old as { id?: string })?.id
          if (!id) return
          setPedidos(prev => prev.filter(p => p.id !== id))
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // setPedidos de useState es estable — no necesita estar en deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ferreteriaId])
}
