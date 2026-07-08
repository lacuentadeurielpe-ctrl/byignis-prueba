import { create } from 'zustand'

export interface CartItem {
  id: string
  nombre: string
  precio_base: number | null
  cantidad: number
  unidad: string
  imagen?: string
  tipo: 'fisico' | 'digital'
}

interface CartState {
  items: CartItem[]
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  addItem: (item: Omit<CartItem, 'cantidad'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, delta: number) => void
  clearCart: () => void
  getTotal: () => number
  getTotalItems: () => number
}

export const useCart = create<CartState>((set, get) => ({
  items: [],
  isOpen: false,
  setIsOpen: (isOpen) => set({ isOpen }),
  addItem: (item) => {
    const { items } = get()
    const existing = items.find((i) => i.id === item.id)
    if (existing) {
      set({
        items: items.map((i) =>
          i.id === item.id ? { ...i, cantidad: i.cantidad + 1 } : i
        ),
      })
    } else {
      set({ items: [...items, { ...item, cantidad: 1 }] })
    }
  },
  removeItem: (id) => {
    set({ items: get().items.filter((i) => i.id !== id) })
  },
  updateQuantity: (id, delta) => {
    const { items } = get()
    set({
      items: items
        .map((i) => {
          if (i.id === id) {
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
      const p = item.precio_base || 0
      return total + p * item.cantidad
    }, 0)
  },
  getTotalItems: () => {
    return get().items.reduce((total, item) => total + item.cantidad, 0)
  },
}))
