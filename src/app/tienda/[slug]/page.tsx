'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Search, Store, ShoppingBag, PackageX, ChevronDown, Package2 } from 'lucide-react'
import { formatPEN } from '@/lib/utils'

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
}

export default function TiendaPage() {
  const { slug } = useParams<{ slug: string }>()
  
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  
  const [loadingInit, setLoadingInit] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  
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

  // Load store info
  useEffect(() => {
    const fetchStore = async () => {
      try {
        const res = await fetch(`/api/public/tienda/${slug}`)
        if (!res.ok) throw new Error('Tienda no encontrada')
        const data = await res.json()
        setStore(data)
      } catch (err: any) {
        setError(err.message)
      }
    }
    fetchStore()
  }, [slug])

  // Load products when page/search changes
  useEffect(() => {
    if (!store) return

    const fetchProducts = async () => {
      try {
        if (page === 1) setLoadingInit(true)
        else setLoadingMore(true)

        const res = await fetch(`/api/public/tienda/${slug}/productos?page=${page}&q=${encodeURIComponent(search)}`)
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

    // Debounce search if page is 1
    const timeout = setTimeout(() => {
      fetchProducts()
    }, page === 1 ? 400 : 0)

    return () => clearTimeout(timeout)
  }, [slug, store, page, search])

  // Reset page when search changes
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }

  const handlePedir = (product: Product) => {
    if (!store?.telefono_whatsapp) return
    const texto = `Hola, vengo del catálogo digital. Me interesa el producto: *${product.nombre}*. ¿Podría darme más información?`
    const wpUrl = `https://wa.me/${store.telefono_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
    window.open(wpUrl, '_blank')
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Store className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Oops</h1>
        <p className="text-gray-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {store?.logo_url ? (
                <img src={store.logo_url} alt={store.nombre} className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
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

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={handleSearch}
                placeholder="Buscar productos..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
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
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <PackageX className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No encontramos productos</h3>
            <p className="text-sm text-gray-500 mt-1">Intenta con otra búsqueda o contacta a la tienda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((p, i) => {
              const hasImages = p.imagenes && p.imagenes.length > 0
              
              return (
                <div 
                  key={`${p.id}-${i}`} 
                  ref={i === products.length - 1 ? lastElementRef : null}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group flex flex-col"
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
                      
                      {p.stock === 0 && store?.config.mostrar_sin_stock && (
                        <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                          Agotado
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="p-4 flex flex-col flex-1">
                    {p.categoria && (
                      <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 mb-1">
                        {p.categoria}
                      </span>
                    )}
                    <h3 className="font-semibold text-gray-900 line-clamp-2 leading-tight mb-2">
                      {p.nombre}
                    </h3>
                    
                    {store?.config.mostrar_descripciones && p.descripcion && (
                      <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                        {p.descripcion}
                      </p>
                    )}
                    
                    <div className="mt-auto">
                      {store?.config.mostrar_precios ? (
                        <div className="flex items-end justify-between mb-4">
                          <div>
                            <span className="text-xl font-bold text-gray-900">
                              {p.precio_base ? formatPEN(p.precio_base) : 'S/ --'}
                            </span>
                            <span className="text-xs text-gray-500 ml-1">/ {p.unidad}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-4" />
                      )}

                      {store?.config.mostrar_precios && store?.config.mostrar_bulk_pricing && p.descuentos && p.descuentos.length > 0 && (
                        <div className="mb-4 bg-emerald-50 rounded-lg p-2.5 border border-emerald-100">
                          <p className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider mb-1.5">Precios por Mayor</p>
                          <div className="space-y-1">
                            {p.descuentos.map((d, idx) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span className="text-emerald-700">Desde {d.cantidad_minima} un.</span>
                                <span className="font-semibold text-emerald-800">{formatPEN(d.precio_unitario)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => handlePedir(p)}
                        className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        Pedir por WhatsApp
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {loadingMore && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 py-6 text-center">
        <p className="text-xs text-gray-400">
          Catálogo creado con <span className="font-semibold text-gray-500">Byignis</span>
        </p>
      </footer>
    </div>
  )
}
