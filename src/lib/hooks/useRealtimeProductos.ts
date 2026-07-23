'use client'

// Mantiene el catálogo de productos sincronizado con la BD en vivo.
//
// Sin esto, el POS y el modal de nuevo pedido trabajaban con el stock del
// momento de cargar la página: tras registrar una venta, el catálogo en
// memoria seguía ofreciendo unidades ya consumidas hasta recargar.
//
// UPDATE llega con la fila completa → se mergea sobre el item local
// (preservando los joins categorias/reglas_descuento que el payload no trae).
// INSERT o reactivación → se refetchea ese producto con los mismos joins que
// usa el server (CatalogRepository.listarProductosActivos) para que la forma
// sea idéntica. Desactivación o DELETE → se remueve de la lista.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Mismo select que CatalogRepository.listarProductosActivos
const SELECT_PRODUCTO = '*, categorias(id,nombre), reglas_descuento(*), variantes_producto(*), producto_atributos(*, valores:atributo_valores(*))'

interface ProductoMinimo {
  id: string
  activo?: boolean
}

export function useRealtimeProductos<T extends ProductoMinimo>(
  ferreteriaId: string | undefined,
  inicial: T[],
): T[] {
  const [productos, setProductos] = useState<T[]>(inicial)

  // Re-sincronizar cuando el server component entrega datos frescos
  useEffect(() => { setProductos(inicial) }, [inicial])

  useEffect(() => {
    if (!ferreteriaId) return
    const supabase = createClient()

    async function agregarSiFalta(id: string) {
      const { data } = await supabase
        .from('productos')
        .select(SELECT_PRODUCTO)
        .eq('id', id)
        .eq('ferreteria_id', ferreteriaId!)
        .eq('activo', true)
        .maybeSingle()
      const completo = data as T | null
      if (!completo) return
      setProductos(prev => prev.some(p => p.id === completo.id) ? prev.map(p => p.id === completo.id ? completo : p) : [...prev, completo])
    }

    const channel = supabase
      .channel(`productos-rt-${ferreteriaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'productos', filter: `ferreteria_id=eq.${ferreteriaId}` },
        (payload) => {
          const nuevo = payload.new as T
          if (nuevo.activo === false) return
          void agregarSiFalta(nuevo.id)
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'productos', filter: `ferreteria_id=eq.${ferreteriaId}` },
        (payload) => {
          const row = payload.new as T
          if (row.activo === false) {
            setProductos(prev => prev.filter(p => p.id !== row.id))
            return
          }
          let estaba = false
          setProductos(prev => {
            estaba = prev.some(p => p.id === row.id)
            // Merge: la fila cruda actualiza stock/precios; los joins locales se conservan
            return estaba ? prev.map(p => (p.id === row.id ? { ...p, ...row } : p)) : prev
          })
          // Producto reactivado que no estaba en la lista → traerlo completo
          if (!estaba) void agregarSiFalta(row.id)
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'productos' },
        (payload) => {
          const id = (payload.old as { id?: string })?.id
          if (!id) return
          setProductos(prev => prev.filter(p => p.id !== id))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'variantes_producto', filter: `ferreteria_id=eq.${ferreteriaId}` },
        (payload) => {
          const prodId = (payload.new as any)?.producto_id || (payload.old as any)?.producto_id
          if (prodId) {
            void agregarSiFalta(prodId)
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ferreteriaId])

  return productos
}
