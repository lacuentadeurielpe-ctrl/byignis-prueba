'use client'

import { useState } from 'react'
import { Plus, ArrowRightLeft, Package, Trash2, Save, X, Search, MapPin } from 'lucide-react'
import { formatPEN } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface TransferManagerProps {
  productos: any[]
  locales: any[]
  stockLocales: any[]
  transferencias: any[]
}

interface TransferItem {
  producto_id: string
  nombre: string
  cantidad: number
  stockMaximo: number
}

export default function TransferManager({
  productos,
  locales,
  stockLocales,
  transferencias
}: TransferManagerProps) {
  const router = useRouter()
  
  const [activeTab, setActiveTab] = useState<'crear' | 'historial'>('crear')
  const [isTransferring, setIsTransferring] = useState(false)
  
  const [localOrigen, setLocalOrigen] = useState<string>('')
  const [localDestino, setLocalDestino] = useState<string>('')
  const [items, setItems] = useState<TransferItem[]>([])
  
  const [busqueda, setBusqueda] = useState('')

  // Validaciones
  const localOrigenValido = localOrigen !== ''
  const localDestinoValido = localDestino !== ''
  const mismoLocal = localOrigen === localDestino && localOrigen !== ''

  // Productos disponibles para transferir (filtrados y con stock en el local origen)
  const productosFiltrados = productos.filter(p => {
    if (!localOrigenValido) return false
    const matchBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
                          (p.codigo_barras && p.codigo_barras.includes(busqueda))
    
    // Calcular stock en el local de origen
    const stockEnLocal = stockLocales.find(s => s.producto_id === p.id && s.local_id === localOrigen)?.stock || 0
    
    return matchBusqueda && stockEnLocal > 0
  }).slice(0, 50)

  const handleAgregarItem = (producto: any) => {
    if (!localOrigenValido) return toast.error('Selecciona primero la sucursal de origen')
    
    const stockEnLocal = stockLocales.find(s => s.producto_id === producto.id && s.local_id === localOrigen)?.stock || 0
    if (stockEnLocal <= 0) return toast.error('No hay stock disponible en la sucursal de origen')

    setItems(prev => {
      const existe = prev.find(i => i.producto_id === producto.id)
      if (existe) {
        if (existe.cantidad >= stockEnLocal) {
          toast.error('No puedes transferir más del stock disponible')
          return prev
        }
        return prev.map(i => i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      }
      return [...prev, { producto_id: producto.id, nombre: producto.nombre, cantidad: 1, stockMaximo: stockEnLocal }]
    })
  }

  const handleUpdateCantidad = (index: number, cantidad: number) => {
    setItems(prev => {
      const newItems = [...prev]
      const item = newItems[index]
      if (cantidad > item.stockMaximo) {
        toast.error('Cantidad excede el stock disponible en la sucursal de origen')
        return prev
      }
      if (cantidad <= 0) {
        newItems.splice(index, 1)
      } else {
        newItems[index].cantidad = cantidad
      }
      return newItems
    })
  }

  const handleEliminarItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!localOrigenValido || !localDestinoValido) return toast.error('Selecciona sucursal de origen y destino')
    if (mismoLocal) return toast.error('El origen y destino no pueden ser la misma sucursal')
    if (items.length === 0) return toast.error('Agrega al menos un producto para transferir')

    setIsTransferring(true)
    try {
      const res = await fetch('/api/sucursales/stock/transferir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localOrigen,
          localDestino,
          items: items.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad }))
        })
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Error al procesar transferencia')
      }

      toast.success('Transferencia exitosa')
      setItems([])
      setLocalOrigen('')
      setLocalDestino('')
      setActiveTab('historial')
      router.refresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsTransferring(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
      {/* TABS */}
      <div className="flex border-b border-zinc-200 px-2 bg-zinc-50/50">
        <button
          onClick={() => setActiveTab('crear')}
          className={`px-6 py-3.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'crear' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
          }`}
        >
          Nueva Transferencia
        </button>
        <button
          onClick={() => setActiveTab('historial')}
          className={`px-6 py-3.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'historial' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
          }`}
        >
          Historial de Transferencias
        </button>
      </div>

      {activeTab === 'crear' && (
        <div className="flex flex-col md:flex-row h-[700px]">
          {/* Panel Izquierdo: Formulario y Carrito */}
          <div className="w-full md:w-[60%] flex flex-col border-r border-zinc-200 bg-white">
            <div className="p-6 border-b border-zinc-200 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 mb-4">
                <ArrowRightLeft className="w-5 h-5 text-indigo-500" />
                Detalles de Movimiento
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Origen (Salida)
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <select
                      value={localOrigen}
                      onChange={(e) => {
                        setLocalOrigen(e.target.value)
                        setItems([]) // Limpiar items si cambia el origen porque el stock máximo cambia
                      }}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">Selecciona una sucursal...</option>
                      {locales.map(l => (
                        <option key={l.id} value={l.id}>{l.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Destino (Entrada)
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <select
                      value={localDestino}
                      onChange={(e) => setLocalDestino(e.target.value)}
                      className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm font-medium focus:ring-2 focus:ring-indigo-500 bg-white ${mismoLocal ? 'border-red-300 ring-1 ring-red-300' : 'border-zinc-200'}`}
                    >
                      <option value="">Selecciona una sucursal...</option>
                      {locales.map(l => (
                        <option key={l.id} value={l.id}>{l.nombre}</option>
                      ))}
                    </select>
                  </div>
                  {mismoLocal && <p className="text-xs text-red-500 mt-1">El destino debe ser diferente</p>}
                </div>
              </div>
            </div>

            {/* Lista de Items a Transferir */}
            <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/50">
              <h3 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center justify-between">
                <span>Productos a Transferir</span>
                <span className="bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full text-xs">{items.length}</span>
              </h3>

              {items.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 rounded-xl">
                  <Package className="w-8 h-8 text-zinc-300 mb-2" />
                  <p className="text-sm text-zinc-500 font-medium">No has agregado productos</p>
                  <p className="text-xs text-zinc-400 mt-1">Busca y selecciona productos desde el panel derecho</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={item.producto_id} className="bg-white p-3 rounded-xl border border-zinc-200 flex items-center justify-between gap-4 shadow-sm">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900 truncate">{item.nombre}</p>
                        <p className="text-xs text-zinc-500">Max disp: {item.stockMaximo}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-zinc-500">Cant:</label>
                        <input
                          type="number"
                          min="1"
                          max={item.stockMaximo}
                          value={item.cantidad}
                          onChange={(e) => handleUpdateCantidad(index, parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1.5 border border-zinc-200 rounded-lg text-sm text-center font-semibold focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <button
                        onClick={() => handleEliminarItem(index)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer con Acción */}
            <div className="p-6 border-t border-zinc-200 bg-white">
              <button
                onClick={handleSubmit}
                disabled={items.length === 0 || !localOrigenValido || !localDestinoValido || mismoLocal || isTransferring}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isTransferring ? 'Transfiriendo...' : (
                  <>
                    <Save className="w-5 h-5" /> Confirmar Transferencia
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Panel Derecho: Buscador de Productos */}
          <div className="w-full md:w-[40%] flex flex-col bg-zinc-50">
            <div className="p-4 border-b border-zinc-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder={localOrigenValido ? "Buscar productos para agregar..." : "Selecciona un local de origen primero..."}
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  disabled={!localOrigenValido}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-zinc-100"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {!localOrigenValido ? (
                <div className="text-center text-zinc-400 text-sm py-10">
                  Selecciona la sucursal de origen para ver su stock disponible.
                </div>
              ) : productosFiltrados.length === 0 ? (
                <div className="text-center text-zinc-400 text-sm py-10">
                  No se encontraron productos con stock en esta sucursal.
                </div>
              ) : (
                productosFiltrados.map(p => {
                  const stockEnLocal = stockLocales.find(s => s.producto_id === p.id && s.local_id === localOrigen)?.stock || 0
                  const enCarrito = items.find(i => i.producto_id === p.id)
                  
                  return (
                    <div key={p.id} className="bg-white p-3 rounded-xl border border-zinc-200 flex items-center justify-between gap-3 hover:border-indigo-300 transition">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 truncate">{p.nombre}</p>
                        <p className="text-xs text-zinc-500">Stock: <span className="font-bold text-zinc-700">{stockEnLocal}</span></p>
                      </div>
                      <button
                        onClick={() => handleAgregarItem(p)}
                        disabled={(enCarrito?.cantidad ?? 0) >= stockEnLocal}
                        className="shrink-0 w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 transition disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'historial' && (
        <div className="p-6">
          {transferencias.length === 0 ? (
            <div className="text-center py-20 text-zinc-500">
              <ArrowRightLeft className="w-12 h-12 mx-auto text-zinc-300 mb-3" />
              <p>No hay transferencias registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase">Origen</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase">Destino</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase text-right">Items Mapeados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {transferencias.map(t => {
                    const lOrigen = locales.find(l => l.id === t.local_origen)?.nombre || 'Desconocido'
                    const lDestino = locales.find(l => l.id === t.local_destino)?.nombre || 'Desconocido'
                    const itemsArray = Array.isArray(t.items) ? t.items : []
                    
                    return (
                      <tr key={t.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 text-sm text-zinc-900 whitespace-nowrap">
                          {new Date(t.created_at).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-600">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-400"></span> {lOrigen}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-600">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> {lDestino}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-900 text-right font-medium">
                          {itemsArray.length} items
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
