import { create } from 'zustand'

export interface CartItem {
  id: string
  nombre: string
  precio_base: number | null
  cantidad: number
  unidad: string
  imagen?: string
  tipo: 'fisico' | 'digital'
  variante_id?: string | null
  nombre_variante?: string | null
  descuentos?: Array<{
    cantidad_minima: number
    precio_unitario: number
  }>
}

interface CartState {
  items: CartItem[]
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  addItem: (item: Omit<CartItem, 'cantidad'>) => void
  removeItem: (cartKey: string) => void
  updateQuantity: (cartKey: string, delta: number) => void
  clearCart: () => void
  getTotal: () => number
  getTotalItems: () => number
}

function getItemKey(item: { id: string; variante_id?: string | null }): string {
  return item.variante_id ? `${item.id}_${item.variante_id}` : item.id
}

export const useCart = create<CartState>((set, get) => ({
  items: [],
  isOpen: false,
  setIsOpen: (isOpen) => set({ isOpen }),
  addItem: (item) => {
    const { items } = get()
    const itemKey = getItemKey(item)
    const existingIndex = items.findIndex((i) => getItemKey(i) === itemKey)
    if (existingIndex >= 0) {
      const newItems = [...items]
      newItems[existingIndex].cantidad += 1
      set({ items: newItems })
    } else {
      set({ items: [...items, { ...item, cantidad: 1 }] })
    }
  },
  removeItem: (cartKey) => {
    set({ items: get().items.filter((i) => getItemKey(i) !== cartKey) })
  },
  updateQuantity: (cartKey, delta) => {
    const { items } = get()
    set({
      items: items
        .map((i) => {
          if (getItemKey(i) === cartKey) {
            const newQuantity = i.cantidad + delta
            return { ...i, cantidad: Math.max(0, newQuantity) }
          }
          return i
        })
        .filter((i) => i.cantidad > 0),
    })
  },
  clearCart: () => set({ items: [] }),
  getTotal: () => {
    return get().items.reduce((total, item) => {
      let p = item.precio_base || 0
      
      // Aplicar reglas de descuento por volumen si existen
      if (item.descuentos && item.descuentos.length > 0) {
        // Ordenar descuentos por cantidad_minima descendente para encontrar el mejor tramo aplicable
        const descuentosOrdenados = [...item.descuentos].sort((a, b) => b.cantidad_minima - a.cantidad_minima)
        const descuentoAplicable = descuentosOrdenados.find(d => item.cantidad >= d.cantidad_minima)
        
        if (descuentoAplicable) {
          p = descuentoAplicable.precio_unitario
        }
      }

      return total + p * item.cantidad
    }, 0)
  },
  getTotalItems: () => {
    return get().items.reduce((total, item) => total + item.cantidad, 0)
  },
}))
