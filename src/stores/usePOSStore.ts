import { create } from 'zustand'
import { type VarianteProducto } from '@/types/database'

export interface ProductoPOS {
  id: string
  nombre: string
  unidad: string
  precio_base: number
  precio_compra: number
  stock: number
  codigo_barras?: string | null
  tiene_variantes?: boolean
  variantes?: VarianteProducto[]
}

export interface ItemCarrito {
  producto_id: string
  nombre_producto: string
  unidad: string
  cantidad: number
  precio_unitario: number
  costo_unitario: number
  variante_id?: string | null
  nombre_variante?: string | null
}

type TipoComprobante = 'nota_venta' | 'boleta' | 'factura'

interface POSState {
  // Estado del Carrito
  items: ItemCarrito[]
  agregarItem: (producto: ProductoPOS) => void
  agregarItemConVariante: (producto: ProductoPOS, variante: VarianteProducto) => void
  actualizarCantidad: (idx: number, delta: number) => void
  eliminarItem: (idx: number) => void
  vaciarCarrito: () => void
  total: number

  // Estado del UI
  busqueda: string
  setBusqueda: (q: string) => void
  mostrarSugerencias: boolean
  setMostrarSugerencias: (val: boolean) => void
  showScanner: boolean
  setShowScanner: (val: boolean) => void
  cobrando: boolean
  setCobrando: (val: boolean) => void

  // Estado del Cliente
  nombreCliente: string
  setNombreCliente: (v: string) => void
  telefonoCliente: string
  setTelefonoCliente: (v: string) => void
  dniRuc: string
  setDniRuc: (v: string) => void
  buscandoRuc: boolean
  setBuscandoRuc: (v: boolean) => void

  // Estado del Comprobante / Cobro
  tipoComprobante: TipoComprobante
  setTipoComprobante: (t: TipoComprobante) => void
  esProgramado: boolean
  setEsProgramado: (v: boolean) => void
  fechaProgramada: string
  setFechaProgramada: (v: string) => void

  // Utilitarios
  resetearDespuesDeVenta: () => void
}

function calcularTotal(items: ItemCarrito[]) {
  return items.reduce((acc, i) => acc + i.cantidad * i.precio_unitario, 0)
}

export const usePOSStore = create<POSState>((set) => ({
  // Carrito
  items: [],
  total: 0,
  agregarItem: (p) => set((state) => {
    const existe = state.items.findIndex(i => i.producto_id === p.id && !i.variante_id)
    let nuevos: ItemCarrito[]
    if (existe >= 0) {
      nuevos = [...state.items]
      nuevos[existe].cantidad += 1
    } else {
      nuevos = [...state.items, {
        producto_id: p.id,
        nombre_producto: p.nombre,
        unidad: p.unidad,
        cantidad: 1,
        precio_unitario: p.precio_base,
        costo_unitario: p.precio_compra
      }]
    }
    return { items: nuevos, total: calcularTotal(nuevos), busqueda: '', mostrarSugerencias: false }
  }),
  agregarItemConVariante: (p, variante) => set((state) => {
    const existe = state.items.findIndex(i => i.producto_id === p.id && i.variante_id === variante.id)
    let nuevos: ItemCarrito[]
    if (existe >= 0) {
      nuevos = [...state.items]
      nuevos[existe].cantidad += 1
    } else {
      nuevos = [...state.items, {
        producto_id: p.id,
        nombre_producto: p.nombre,
        unidad: p.unidad,
        cantidad: 1,
        precio_unitario: variante.precio ?? p.precio_base,
        costo_unitario: variante.precio_compra ?? p.precio_compra,
        variante_id: variante.id,
        nombre_variante: variante.nombre_variante,
      }]
    }
    return { items: nuevos, total: calcularTotal(nuevos), busqueda: '', mostrarSugerencias: false }
  }),
  actualizarCantidad: (idx, delta) => set((state) => {
    const nuevos = [...state.items]
    nuevos[idx].cantidad += delta
    if (nuevos[idx].cantidad < 1) nuevos[idx].cantidad = 1
    return { items: nuevos, total: calcularTotal(nuevos) }
  }),
  eliminarItem: (idx) => set((state) => {
    const nuevos = state.items.filter((_, i) => i !== idx)
    return { items: nuevos, total: calcularTotal(nuevos) }
  }),
  vaciarCarrito: () => set({ items: [], total: 0 }),

  // UI
  busqueda: '',
  setBusqueda: (q) => set({ busqueda: q }),
  mostrarSugerencias: false,
  setMostrarSugerencias: (val) => set({ mostrarSugerencias: val }),
  showScanner: false,
  setShowScanner: (val) => set({ showScanner: val }),
  cobrando: false,
  setCobrando: (val) => set({ cobrando: val }),

  // Cliente
  nombreCliente: '',
  setNombreCliente: (v) => set({ nombreCliente: v }),
  telefonoCliente: '',
  setTelefonoCliente: (v) => set({ telefonoCliente: v }),
  dniRuc: '',
  setDniRuc: (v) => set({ dniRuc: v }),
  buscandoRuc: false,
  setBuscandoRuc: (v) => set({ buscandoRuc: v }),

  // Comprobante
  tipoComprobante: 'nota_venta',
  setTipoComprobante: (t) => set({ tipoComprobante: t }),
  esProgramado: false,
  setEsProgramado: (v) => set({ esProgramado: v }),
  fechaProgramada: '',
  setFechaProgramada: (v) => set({ fechaProgramada: v }),

  // Utilities
  resetearDespuesDeVenta: () => set({
    items: [],
    total: 0,
    nombreCliente: '',
    telefonoCliente: '',
    dniRuc: '',
    tipoComprobante: 'nota_venta',
    esProgramado: false,
    fechaProgramada: ''
  })
}))
