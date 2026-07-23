'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Search, Store, ShoppingBag, PackageX, Package2, Plus, Minus, ShoppingCart } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatPEN } from '@/lib/utils'
import { useCart, CartItem } from './store/useCart'
import ShoppingCartDrawer from './components/ShoppingCartDrawer'

import { Sparkles, Check } from 'lucide-react'
import Modal from '@/components/ui/Modal'

interface StoreInfo {
  id: string
  nombre: string
  telefono_whatsapp: string
  logo_url: string | null
  mensaje_bienvenida: string | null
  config: {
    mostrar_precios: boolean
    mostrar_sin_stock: boolean
    mostrar_descripciones: boolean
    mostrar_imagenes: boolean
    mostrar_bulk_pricing: boolean
  }
}

export interface VariantePublica {
  id: string
  nombre_variante: string
  precio: number | null
  stock: number
  sku?: string | null
  imagen_url?: string | null
  activo?: boolean
}

export interface AtributoPublico {
  id: string
  nombre: string
  valores: Array<{ id: string; valor: string; color_hex?: string | null }>
}

interface Product {
  id: string
  nombre: string
  categoria?: string
  marca?: string
  stock: number
  precio_base: number | null
  unidad: string
  descripcion: string | null
  imagenes: string[]
  descuentos: Array<{
    cantidad_minima: number
    precio_unitario: number
  }>
  tipo: 'fisico' | 'digital'
  tiene_variantes?: boolean
  variantes?: VariantePublica[]
  atributos?: AtributoPublico[]
}

interface Categoria {
  id: string
  nombre: string
}

export default function TiendaPage() {
  const { slug } = useParams<{ slug: string }>()
  
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  
  const [loadingInit, setLoadingInit] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'fisico' | 'digital'>('fisico')
  
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // State para modal de selección de variante en tienda pública
  const [productoModalVariante, setProductoModalVariante] = useState<Product | null>(null)
  
  const { items: cartItems, addItem, updateQuantity, getTotalItems, setIsOpen } = useCart()

  const observerRef = useRef<IntersectionObserver | null>(null)
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loadingMore) return
    if (observerRef.current) observerRef.current.disconnect()
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => prev + 1)
      }
    })
    
    if (node) observerRef.current.observe(node)
  }, [loadingMore, hasMore])

  // Load store info & categories
  useEffect(() => {
    const fetchStore = async () => {
      try {
        const res = await fetch(`/api/public/tienda/${slug}`)
        if (!res.ok) throw new Error('Tienda no encontrada')
        const data = await res.json()
        setStore(data)
        
        // Cargar categorías
        const catRes = await fetch(`/api/settings-2/catalogo/categorias`)
        if (catRes.ok) {
          const catData = await catRes.json()
          setCategorias(catData)
        }
      } catch (err: any) {
        setError(err.message)
      }
    }
    fetchStore()
  }, [slug])

  // Load products
  useEffect(() => {
    if (!store) return

    const fetchProducts = async () => {
      try {
        if (page === 1) setLoadingInit(true)
        else setLoadingMore(true)

        const url = new URL(window.location.origin + `/api/public/tienda/${slug}/productos`)
        url.searchParams.set('page', page.toString())
        url.searchParams.set('tipo', activeTab)
        if (search) url.searchParams.set('q', search)
        if (selectedCategory) url.searchParams.set('cat', selectedCategory)

        const res = await fetch(url.toString())
        if (!res.ok) throw new Error('Error al cargar productos')
        const data = await res.json()

        setProducts(prev => page === 1 ? data.items : [...prev, ...data.items])
        setHasMore(data.page < data.totalPages)
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingInit(false)
        setLoadingMore(false)
      }
    }

    const timeout = setTimeout(() => {
      fetchProducts()
    }, page === 1 ? 400 : 0)

    return () => clearTimeout(timeout)
  }, [slug, store, page, search, selectedCategory, activeTab])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }

  const handleTabChange = (tab: 'fisico' | 'digital') => {
    setActiveTab(tab)
    setPage(1)
    setProducts([])
  }

  const handleCategorySelect = (id: string) => {
    setSelectedCategory(prev => prev === id ? '' : id)
    setPage(1)
    setProducts([])
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <Store className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Oops</h1>
        <p className="text-gray-500">{error}</p>
      </div>
    )
  }

  const totalItemsInCart = getTotalItems()

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <ShoppingCartDrawer storePhone={store?.telefono_whatsapp || null} storeName={store?.nombre || ''} />

      {/* Floating Action Button */}
      <AnimatePresence>
        {totalItemsInCart > 0 && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-40 bg-gray-900 text-white p-4 rounded-full shadow-2xl hover:bg-gray-800 transition-all flex items-center gap-3 pr-6 group"
          >
            <div className="relative">
              <ShoppingCart className="w-6 h-6" />
              <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-gray-900">
                {totalItemsInCart}
              </span>
            </div>
            <span className="font-semibold text-sm">Ver Carrito</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4">
            {/* Top row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {store?.logo_url ? (
                  <img src={store.logo_url} alt={store.nombre} className="w-10 h-10 rounded-xl object-cover shadow-sm" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shadow-sm">
                    <Store className="w-5 h-5 text-indigo-600" />
                  </div>
                )}
                <div>
                  <h1 className="font-bold text-gray-900 text-lg sm:text-xl">
                    {store?.nombre || <span className="w-32 h-6 bg-gray-200 animate-pulse block rounded" />}
                  </h1>
                  {store?.mensaje_bienvenida && (
                    <p className="text-xs text-gray-500 line-clamp-1">{store.mensaje_bienvenida}</p>
                  )}
                </div>
              </div>

              {/* Tabs Fisico/Digital */}
              <div className="hidden sm:flex bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => handleTabChange('fisico')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'fisico' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  📦 Físicos
                </button>
                <button
                  onClick={() => handleTabChange('digital')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'digital' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  💻 Digitales
                </button>
              </div>
            </div>

            {/* Mobile Tabs */}
            <div className="flex sm:hidden bg-gray-100 p-1 rounded-xl w-full">
              <button
                onClick={() => handleTabChange('fisico')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'fisico' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                📦 Físicos
              </button>
              <button
                onClick={() => handleTabChange('digital')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'digital' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                💻 Digitales
              </button>
            </div>

            {/* Search and Categories row */}
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <div className="relative w-full sm:w-80 flex-shrink-0">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={handleSearch}
                  placeholder="Buscar productos..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner"
                />
              </div>

              {/* Categorias scroll horizontal */}
              <div className="w-full overflow-x-auto pb-1 scrollbar-hide">
                <div className="flex gap-2 min-w-max px-1">
                  <button
                    onClick={() => handleCategorySelect('')}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${!selectedCategory ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    Todos
                  </button>
                  {categorias.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.id)}
                      className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${selectedCategory === cat.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {cat.nombre}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 w-full">
        {loadingInit && page === 1 ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : products.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <PackageX className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No encontramos productos</h3>
            <p className="text-sm text-gray-500 mt-1">Intenta con otra búsqueda o categoría.</p>
          </motion.div>
        ) : (
          <motion.div 
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            <AnimatePresence>
              {products.map((p, i) => {
                const hasImages = p.imagenes && p.imagenes.length > 0
                const qtyInCart = cartItems.filter(item => item.id === p.id).reduce((sum, item) => sum + item.cantidad, 0)
                
                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={`${p.id}`} 
                    ref={i === products.length - 1 ? lastElementRef : null}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col"
                  >
                    {store?.config.mostrar_imagenes && (
                      <div className="aspect-square bg-gray-50 border-b border-gray-100 relative overflow-hidden">
                        {hasImages ? (
                          <img 
                            src={p.imagenes[0]} 
                            alt={p.nombre} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                            <Package2 className="w-12 h-12 mb-2 opacity-50" />
                          </div>
                        )}
                        
                        {p.stock === 0 && store?.config.mostrar_sin_stock && p.tipo === 'fisico' && (
                          <div className="absolute top-3 right-3 bg-red-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm uppercase tracking-wider">
                            Agotado
                          </div>
                        )}
                        {p.tipo === 'digital' && (
                          <div className="absolute top-3 left-3 bg-indigo-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm uppercase tracking-wider flex items-center gap-1">
                            💻 Digital
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="p-5 flex flex-col flex-1">
                      {p.categoria && (
                        <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 mb-1.5">
                          {p.categoria}
                        </span>
                      )}
                      <h3 className="font-semibold text-gray-900 line-clamp-2 leading-tight mb-1">
                        {p.nombre}
                      </h3>

                      {p.tiene_variantes && p.atributos && p.atributos.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap my-1.5">
                          {p.atributos.map(at => (
                            <div key={at.id} className="flex items-center gap-1 flex-wrap">
                              {at.valores.map(v => (
                                v.color_hex ? (
                                  <span
                                    key={v.id}
                                    className="w-3.5 h-3.5 rounded-full border border-gray-300 shadow-xs inline-block"
                                    style={{ backgroundColor: v.color_hex }}
                                    title={`${at.nombre}: ${v.valor}`}
                                  />
                                ) : (
                                  <span
                                    key={v.id}
                                    className="px-1.5 py-0.5 text-[9px] font-semibold bg-gray-100 text-gray-600 rounded"
                                  >
                                    {v.valor}
                                  </span>
                                )
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {store?.config.mostrar_descripciones && p.descripcion && (
                         <p className="text-xs text-gray-500 line-clamp-2 mb-4 flex-1">
                          {p.descripcion}
                        </p>
                      )}
                      
                      <div className="mt-auto pt-2">
                        {store?.config.mostrar_precios ? (
                          <div className="flex items-end justify-between mb-4">
                            <div>
                              <span className="text-xl font-black text-gray-900">
                                {p.precio_base ? formatPEN(p.precio_base) : 'S/ --'}
                              </span>
                              <span className="text-xs text-gray-500 ml-1 font-medium">/ {p.unidad}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="h-4" />
                        )}

                        {qtyInCart > 0 && !p.tiene_variantes ? (
                          <div className="flex items-center justify-between bg-emerald-50 rounded-xl p-1 border border-emerald-100 h-11">
                            <button
                              onClick={() => updateQuantity(p.id, -1)}
                              className="w-9 h-9 flex items-center justify-center hover:bg-white rounded-lg hover:shadow-sm transition-all text-emerald-700"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-bold text-emerald-900">{qtyInCart}</span>
                            <button
                              onClick={() => updateQuantity(p.id, 1)}
                              className="w-9 h-9 flex items-center justify-center hover:bg-white rounded-lg hover:shadow-sm transition-all text-emerald-700"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              if (p.tiene_variantes && p.variantes && p.variantes.length > 0) {
                                setProductoModalVariante(p)
                              } else {
                                addItem({
                                  id: p.id,
                                  nombre: p.nombre,
                                  precio_base: p.precio_base,
                                  unidad: p.unidad,
                                  imagen: hasImages ? p.imagenes[0] : undefined,
                                  tipo: p.tipo,
                                  descuentos: p.descuentos
                                })
                              }
                            }}
                            disabled={p.stock === 0 && store?.config.mostrar_sin_stock && p.tipo === 'fisico'}
                            className="w-full h-11 bg-gray-50 hover:bg-indigo-50 text-indigo-600 border border-indigo-100 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group-hover:bg-indigo-600 group-hover:text-white"
                          >
                            {p.tiene_variantes ? (
                              <>
                                <Sparkles className="w-4 h-4 text-orange-500" />
                                {qtyInCart > 0 ? `Opciones (${qtyInCart})` : 'Opciones'}
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4" />
                                Agregar
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}

        {loadingMore && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}
      </main>

      {/* Modal Selección de Variante en Tienda Pública */}
      {productoModalVariante && (
        <Modal
          open={!!productoModalVariante}
          onClose={() => setProductoModalVariante(null)}
          title={`Opciones de "${productoModalVariante.nombre}"`}
          size="sm"
        >
          <div className="space-y-3 pt-2">
            <p className="text-xs text-gray-500">
              Selecciona la combinación deseada:
            </p>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {productoModalVariante.variantes?.map((v) => {
                const stockVal = v.stock ?? 0
                const agotado = stockVal === 0
                return (
                  <button
                    key={v.id}
                    disabled={agotado}
                    onClick={() => {
                      addItem({
                        id: productoModalVariante.id,
                        nombre: productoModalVariante.nombre,
                        precio_base: v.precio ?? productoModalVariante.precio_base,
                        unidad: productoModalVariante.unidad,
                        imagen: v.imagen_url || (productoModalVariante.imagenes?.[0]),
                        tipo: productoModalVariante.tipo,
                        variante_id: v.id,
                        nombre_variante: v.nombre_variante,
                        descuentos: productoModalVariante.descuentos
                      })
                      setProductoModalVariante(null)
                      setIsOpen(true)
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition text-left ${
                      agotado
                        ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                        : 'border-gray-200 hover:border-indigo-600 hover:bg-indigo-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                      {v.imagen_url && (
                        <img src={v.imagen_url} alt={v.nombre_variante} className="w-10 h-10 object-cover rounded-lg border border-gray-100 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <h5 className="font-bold text-sm text-gray-900 flex items-center gap-1.5 truncate">
                          <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                          <span className="truncate">{v.nombre_variante}</span>
                        </h5>
                        {v.sku && <p className="text-[11px] text-gray-400 font-mono truncate">SKU: {v.sku}</p>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm text-gray-900">
                        {formatPEN(v.precio ?? productoModalVariante.precio_base ?? 0)}
                      </p>
                      <p className={`text-xs ${agotado ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                        {agotado ? 'Agotado' : `Stock: ${stockVal}`}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </Modal>
      )}

      <footer className="bg-white border-t border-gray-200 py-8 text-center">
        <p className="text-xs text-gray-400">
          Catálogo creado con <span className="font-semibold text-gray-900">Byignis</span>
        </p>
      </footer>
    </div>
  )
}
