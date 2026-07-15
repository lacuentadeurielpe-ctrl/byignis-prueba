'use client'

import { useState, useEffect } from 'react'
import { X, TrendingUp, Target, Users, Calendar, ArrowUpRight, DollarSign, Loader2 } from 'lucide-react'
import { formatPEN } from '@/lib/utils'

interface IngresosDashboardModalProps {
  isOpen: boolean
  onClose: () => void
  clientes: any[]
}

export default function IngresosDashboardModal({ isOpen, onClose, clientes }: IngresosDashboardModalProps) {
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return

    const fetchCotizaciones = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/cotizaciones')
        if (res.ok) {
          const data = await res.json()
          setCotizaciones(data || [])
        }
      } catch (error) {
        console.error('Error fetching cotizaciones:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCotizaciones()
  }, [isOpen])

  if (!isOpen) return null

  // --- Cálculos Frontend (sin tocar backend) ---
  
  // 1. Top Compradores Históricos
  const topCompradores = [...clientes]
    .filter(c => c.totalGastado > 0)
    .sort((a, b) => b.totalGastado - a.totalGastado)
    .slice(0, 5)

  // 2. Intenciones de Compra (Cotizaciones Totales)
  const totalCotizado = cotizaciones.reduce((acc, c) => acc + (c.total || 0), 0)
  
  // 3. Tasa de Conversión (Asumiendo cotizaciones con estado 'aprobada' como convertidas)
  const cotizacionesAprobadas = cotizaciones.filter(c => c.estado === 'aprobada').length
  const tasaConversion = cotizaciones.length > 0 
    ? Math.round((cotizacionesAprobadas / cotizaciones.length) * 100) 
    : 0

  // 4. Ticket Promedio (Gastado / Total Pedidos de los que compraron)
  const totalPedidos = clientes.reduce((acc, c) => acc + (c.totalPedidos || 0), 0)
  const totalIngresos = clientes.reduce((acc, c) => acc + (c.totalGastado || 0), 0)
  const ticketPromedio = totalPedidos > 0 ? totalIngresos / totalPedidos : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        
        {/* Header Modal */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-white border-b border-zinc-100 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Dashboard de Ingresos & Cotizaciones</h2>
            <p className="text-sm text-zinc-500">Métricas avanzadas y comportamiento de compra</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-indigo-600">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p className="text-sm font-medium text-zinc-500">Analizando datos de ingresos...</p>
            </div>
          ) : (
            <>
              {/* Top Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
                  <div className="flex items-center gap-2 text-indigo-600 mb-2">
                    <Target className="w-5 h-5" />
                    <h3 className="text-sm font-semibold">Tasa de Conversión</h3>
                  </div>
                  <p className="text-3xl font-bold text-indigo-900">{tasaConversion}%</p>
                  <p className="text-xs text-indigo-600/80 mt-1">Cotizaciones aprobadas vs totales</p>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                  <div className="flex items-center gap-2 text-emerald-600 mb-2">
                    <DollarSign className="w-5 h-5" />
                    <h3 className="text-sm font-semibold">Ticket Promedio</h3>
                  </div>
                  <p className="text-3xl font-bold text-emerald-900">{formatPEN(ticketPromedio)}</p>
                  <p className="text-xs text-emerald-600/80 mt-1">Por pedido completado</p>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <Calendar className="w-5 h-5" />
                    <h3 className="text-sm font-semibold">Intenciones Totales</h3>
                  </div>
                  <p className="text-3xl font-bold text-blue-900">{formatPEN(totalCotizado)}</p>
                  <p className="text-xs text-blue-600/80 mt-1">Suma de todas las cotizaciones</p>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                  <div className="flex items-center gap-2 text-amber-600 mb-2">
                    <Users className="w-5 h-5" />
                    <h3 className="text-sm font-semibold">Total Cotizaciones</h3>
                  </div>
                  <p className="text-3xl font-bold text-amber-900">{cotizaciones.length}</p>
                  <p className="text-xs text-amber-600/80 mt-1">Generadas históricamente</p>
                </div>
              </div>

              {/* Secciones Detalladas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Compradores */}
                <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 bg-zinc-50 border-b border-zinc-200">
                    <h3 className="font-bold text-zinc-800 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      Top 5 Mejores Clientes
                    </h3>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {topCompradores.length > 0 ? topCompradores.map((cliente, idx) => (
                      <div key={cliente.id} className="flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-zinc-900">{cliente.nombre || cliente.alias || 'Cliente'}</p>
                            <p className="text-xs text-zinc-500">{cliente.totalPedidos} pedidos</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">{formatPEN(cliente.totalGastado)}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="p-8 text-center text-zinc-500 text-sm">Aún no hay compras registradas.</div>
                    )}
                  </div>
                </div>

                {/* Info extra / Recomendaciones (Simuladas) */}
                <div className="space-y-4">
                  <div className="p-5 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl text-white shadow-md">
                    <h3 className="font-bold mb-3 flex items-center gap-2">
                      <ArrowUpRight className="w-5 h-5 text-indigo-400" />
                      Oportunidades de Retención
                    </h3>
                    <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                      Tus clientes activos representan el motor principal de flujo de caja. Recomendamos crear una etiqueta de "Cliente VIP" para el top 5% y enviarles ofertas exclusivas vía WhatsApp.
                    </p>
                    <button className="text-sm font-medium bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors w-full text-center">
                      Ir a Campañas (Difusiones)
                    </button>
                  </div>

                  <div className="p-5 border border-zinc-200 rounded-2xl">
                    <h3 className="text-sm font-bold text-zinc-800 mb-1">Distribución de Ingresos</h3>
                    <p className="text-xs text-zinc-500 mb-4">Relación entre cotizaciones emitidas y compras cerradas.</p>
                    <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden flex">
                      <div className="bg-emerald-500 h-full" style={{ width: `${tasaConversion}%` }} />
                      <div className="bg-amber-400 h-full" style={{ width: `${100 - tasaConversion}%` }} />
                    </div>
                    <div className="flex justify-between mt-2 text-xs font-medium">
                      <span className="text-emerald-600">Convertido ({tasaConversion}%)</span>
                      <span className="text-amber-600">Pendiente ({100 - tasaConversion}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
