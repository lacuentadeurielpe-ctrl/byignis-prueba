'use client'

import { LineChart, Star, TrendingUp, TrendingDown, Target, Clock, MessageSquareWarning } from 'lucide-react'

export default function TabDesempeno({ empleadoId }: { empleadoId: string }) {
  // Datos mock para demostración (Fase UI)
  const metricas = [
    { label: 'Puntualidad', valor: '98%', estado: 'bueno', icon: Clock },
    { label: 'Ventas del Mes', valor: 'S/ 12,450', estado: 'excelente', icon: TrendingUp },
    { label: 'Meta Alcanzada', valor: '115%', estado: 'excelente', icon: Target },
    { label: 'Llamados de Atención', valor: '1', estado: 'regular', icon: MessageSquareWarning },
  ]

  const historialDesempeno = [
    { id: '1', fecha: '2026-06-30', evaluador: 'Gerencia General', puntaje: 4.8, comentario: 'Excelente actitud con los clientes de mostrador. Superó su meta de ventas de herramientas eléctricas.' },
    { id: '2', fecha: '2026-03-31', evaluador: 'Gerencia General', puntaje: 4.2, comentario: 'Buen desempeño general, aunque tuvo un par de tardanzas en la quincena.' },
  ]

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 fade-in duration-300">
      
      {/* KPIs Rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricas.map((m, i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 rounded-xl ${
                m.estado === 'excelente' ? 'bg-emerald-50 text-emerald-600' :
                m.estado === 'bueno' ? 'bg-blue-50 text-blue-600' :
                'bg-orange-50 text-orange-600'
              }`}>
                <m.icon className="w-5 h-5" />
              </div>
              <TrendingUp className="w-4 h-4 text-zinc-300 group-hover:text-zinc-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">{m.valor}</p>
              <p className="text-sm font-medium text-zinc-500 mt-1">{m.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Historial de Evaluaciones */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
          <div>
            <h3 className="font-bold text-zinc-900 text-lg">Evaluaciones Formales</h3>
            <p className="text-sm text-zinc-500">Historial de feedback y revisiones 360°.</p>
          </div>
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm">
            Nueva Evaluación
          </button>
        </div>

        <div className="divide-y divide-zinc-100">
          {historialDesempeno.map(evaluacion => (
            <div key={evaluacion.id} className="p-6 hover:bg-zinc-50/50 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold text-zinc-900 flex items-center gap-2">
                    Revisión Trimestral
                    <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-xs font-mono">{evaluacion.fecha}</span>
                  </h4>
                  <p className="text-sm text-zinc-500 mt-0.5">Evaluado por: {evaluacion.evaluador}</p>
                </div>
                <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-lg border border-yellow-200">
                  <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                  <span className="font-bold text-sm">{evaluacion.puntaje} / 5.0</span>
                </div>
              </div>
              <p className="text-sm text-zinc-700 bg-zinc-50 border border-zinc-100 p-4 rounded-xl italic">
                "{evaluacion.comentario}"
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
