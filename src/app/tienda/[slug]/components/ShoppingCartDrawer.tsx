'use client'

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, ShoppingCart, Plus, Minus, Send } from 'lucide-react'
import { useCart } from '../store/useCart'
import { formatPEN } from '@/lib/utils'

interface ShoppingCartDrawerProps {
  storePhone: string | null
  storeName: string
}

export default function ShoppingCartDrawer({ storePhone, storeName }: ShoppingCartDrawerProps) {
  const { items, isOpen, setIsOpen, updateQuantity, removeItem, getTotal } = useCart()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const handleSendWhatsApp = () => {
    if (!storePhone) return
    
    let text = `Hola *${storeName}*, me interesan estos productos:\n\n`
    
    items.forEach(item => {
      let unitPrice = item.precio_base || 0
      
      if (item.descuentos && item.descuentos.length > 0) {
        const descuentosOrdenados = [...item.descuentos].sort((a, b) => b.cantidad_minima - a.cantidad_minima)
        const descuentoAplicable = descuentosOrdenados.find(d => item.cantidad >= d.cantidad_minima)
        if (descuentoAplicable) {
          unitPrice = descuentoAplicable.precio_unitario
        }
      }

      const typeLabel = item.tipo === 'digital' ? '[Digital] ' : ''
      const variantLabel = item.nombre_variante ? ` (${item.nombre_variante})` : ''
      const priceText = item.precio_base ? `(${formatPEN(unitPrice)})` : ''
      text += `- ${item.cantidad}x ${typeLabel}${item.nombre}${variantLabel} ${priceText}\n`
    })

    const total = getTotal()
    if (total > 0) {
      text += `\n*Total aproximado: ${formatPEN(total)}*\n`
    }

    text += `\n¿Me pueden confirmar stock y disponibilidad?`

    const wpUrl = `https://wa.me/${storePhone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
    window.open(wpUrl, '_blank')
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={setIsOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-500"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-500"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                      <div className="flex items-start justify-between">
                        <Dialog.Title className="text-lg font-medium text-gray-900 flex items-center gap-2">
                          <ShoppingCart className="w-5 h-5 text-indigo-600" />
                          Tu Carrito
                        </Dialog.Title>
                        <div className="ml-3 flex h-7 items-center">
                          <button
                            type="button"
                            className="relative -m-2 p-2 text-gray-400 hover:text-gray-500"
                            onClick={() => setIsOpen(false)}
                          >
                            <span className="absolute -inset-0.5" />
                            <span className="sr-only">Cerrar panel</span>
                            <X className="h-6 w-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-8">
                        <div className="flow-root">
                          {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <ShoppingCart className="w-8 h-8 text-gray-300" />
                              </div>
                              <h3 className="text-base font-medium text-gray-900 mb-1">Tu carrito está vacío</h3>
                              <p className="text-sm text-gray-500">Agrega productos del catálogo para armar tu cotización.</p>
                            </div>
                          ) : (
                            <ul role="list" className="-my-6 divide-y divide-gray-200">
                              {items.map((item) => {
                                const cartKey = item.variante_id ? `${item.id}_${item.variante_id}` : item.id
                                return (
                                  <li key={cartKey} className="flex py-6">
                                    {item.imagen && (
                                      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-gray-200">
                                        <img
                                          src={item.imagen}
                                          alt={item.nombre}
                                          className="h-full w-full object-cover object-center"
                                        />
                                      </div>
                                    )}

                                    <div className="ml-4 flex flex-1 flex-col">
                                      <div>
                                        <div className="flex justify-between text-sm font-medium text-gray-900 mb-1">
                                          <div className="min-w-0 flex-1">
                                            <h3 className="line-clamp-2 leading-tight">
                                              {item.tipo === 'digital' && <span className="mr-1">💻</span>}
                                              {item.nombre}
                                            </h3>
                                            {item.nombre_variante && (
                                              <p className="text-xs text-orange-600 font-semibold mt-0.5">› {item.nombre_variante}</p>
                                            )}
                                          </div>
                                          <p className="ml-4 whitespace-nowrap">
                                            {item.precio_base ? (() => {
                                              let p = item.precio_base || 0
                                              if (item.descuentos && item.descuentos.length > 0) {
                                                const descOrd = [...item.descuentos].sort((a, b) => b.cantidad_minima - a.cantidad_minima)
                                                const d = descOrd.find(d => item.cantidad >= d.cantidad_minima)
                                                if (d) p = d.precio_unitario
                                              }
                                              return formatPEN(p * item.cantidad)
                                            })() : 'S/ --'}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex flex-1 items-end justify-between text-sm">
                                        <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1 border border-gray-100">
                                          <button
                                            onClick={() => updateQuantity(cartKey, -1)}
                                            className="p-1 hover:bg-white rounded-md hover:shadow-sm transition-all"
                                          >
                                            <Minus className="w-4 h-4 text-gray-600" />
                                          </button>
                                          <span className="font-medium text-gray-900 w-4 text-center">{item.cantidad}</span>
                                          <button
                                            onClick={() => updateQuantity(cartKey, 1)}
                                            className="p-1 hover:bg-white rounded-md hover:shadow-sm transition-all"
                                          >
                                            <Plus className="w-4 h-4 text-gray-600" />
                                          </button>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => removeItem(cartKey)}
                                          className="font-medium text-red-600 hover:text-red-500 text-xs"
                                        >
                                          Eliminar
                                        </button>
                                      </div>
                                    </div>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>

                    {items.length > 0 && (
                      <div className="border-t border-gray-200 px-4 py-6 sm:px-6 bg-gray-50/50">
                        <div className="flex justify-between text-base font-medium text-gray-900 mb-4">
                          <p>Subtotal referencial</p>
                          <p>{getTotal() > 0 ? formatPEN(getTotal()) : 'S/ --'}</p>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500 mb-6">
                          * Los precios y el stock final serán confirmados al comunicarte con la tienda por WhatsApp.
                        </p>
                        <div className="mt-6">
                          <button
                            onClick={handleSendWhatsApp}
                            className="flex items-center justify-center gap-2 w-full rounded-xl border border-transparent bg-emerald-600 px-6 py-4 text-base font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors"
                          >
                            <Send className="w-5 h-5" />
                            Solicitar Cotización
                          </button>
                        </div>
                        <div className="mt-6 flex justify-center text-center text-sm text-gray-500">
                          <p>
                            o{' '}
                            <button
                              type="button"
                              className="font-medium text-indigo-600 hover:text-indigo-500"
                              onClick={() => setIsOpen(false)}
                            >
                              Continuar viendo productos
                              <span aria-hidden="true"> &rarr;</span>
                            </button>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
