'use client'

import { useState } from 'react'
import { ReceiptText, CheckCircle2, AlertCircle, FileText, Download, Wallet, TrendingUp } from 'lucide-react'

export default function TabNominas({ empleadoId }: { empleadoId: string }) {
  const [modalidad, setModalidad] = useState<'formal' | 'informal'>('informal')
  const [salarioBase, setSalarioBase] = useState('1500')
  const [frecuencia, setFrecuencia] = useState('quincenal')

  // Datos mock para demostración de UI (Fase UI)
  const historialNominas = [
    { id: '1', fecha: '2026-06-30', periodo: 'Junio 2026 - Q2', monto: 750, estado: 'pagado', modalidad: 'informal' },
    { id: '2', fecha: '2026-06-15', periodo: 'Junio 2026 - Q1', monto: 750, estado: 'pagado', modalidad: 'informal' },
    { id: '3', fecha: '2026-05-31', periodo: 'Mayo 2026 - Q2', monto: 750, estado: 'pagado', modalidad: 'informal' },
  ]

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 fade-in duration-300">
      
      {/* Tarjeta de Configuración Salarial */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-green-50 text-green-600 rounded-xl">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 text-lg">Configuración Salarial</h3>
            <p className="text-sm text-zinc-500">Define cómo y cuánto se le pagará a este empleado.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-700">Salario Base (Mensual)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-zinc-500 font-medium">S/</span>
              <input 
                type="number" 
                value={salarioBase}
                onChange={(e) => setSalarioBase(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-700">Modalidad (SUNAT)</label>
            <select 
              value={modalidad}
              onChange={(e) => setModalidad(e.target.value as any)}
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            >
              <option value="informal">Interno (Sin SUNAT)</option>
              <option value="formal">Planilla Formal (Con SUNAT)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-700">Frecuencia de Pago</label>
            <select 
              value={frecuencia}
              onChange={(e) => setFrecuencia(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            >
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-xl transition-all shadow-sm active:scale-95">
            Guardar Configuración
          </button>
        </div>
      </div>

      {/* Alerta si es informal */}
      {modalidad === 'informal' && (
        <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-orange-900">Modalidad Interna (Sin Declaración)</h4>
            <p className="text-sm text-orange-700 mt-1">
              Actualmente este empleado está configurado con nómina interna. Los recibos generados aquí servirán como comprobantes internos de pago, pero <strong>no se reportarán a SUNAT ni a los libros contables electrónicos</strong> de la empresa.
            </p>
          </div>
        </div>
      )}

      {/* Historial de Nóminas */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
          <div>
            <h3 className="font-bold text-zinc-900 text-lg">Historial de Pagos</h3>
            <p className="text-sm text-zinc-500">Últimos recibos de nómina emitidos.</p>
          </div>
          <button className="px-4 py-2 bg-white border border-zinc-200 text-zinc-700 text-sm font-semibold rounded-xl hover:bg-zinc-50 transition-all shadow-sm">
            Generar Pago Manual
          </button>
        </div>

        <div className="divide-y divide-zinc-100">
          {historialNominas.map(nomina => (
            <div key={nomina.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                  <ReceiptText className="w-5 h-5 text-zinc-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-900">{nomina.periodo}</h4>
                  <p className="text-sm text-zinc-500 font-mono mt-0.5">{nomina.fecha}</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="font-bold text-zinc-900">S/ {nomina.monto.toFixed(2)}</p>
                  <div className="flex items-center gap-1.5 justify-end mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">{nomina.estado}</span>
                  </div>
                </div>
                
                <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors" title="Descargar Boleta de Pago">
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
