'use client'

import { useState } from 'react'
import { FileText, Loader2, Check } from 'lucide-react'

interface Props {
  cliente: any
  onUpdate: (notas: string | null) => void
}

export default function TabNotas({ cliente, onUpdate }: Props) {
  const [notas, setNotas] = useState(cliente.notas_internas || '')
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  async function guardar() {
    setGuardando(true)
    setGuardado(false)
    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notas_internas: notas.trim() || null })
      })
      if (!res.ok) throw new Error()
      
      onUpdate(notas.trim() || null)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2000)
    } catch (e) {
      alert('Error al guardar notas')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden max-w-2xl">
      <div className="p-6 border-b border-zinc-100 flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-zinc-900">Notas Internas</h3>
          <p className="text-xs text-zinc-500">Información privada, el cliente no verá esto.</p>
        </div>
      </div>
      
      <div className="p-6">
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Escribe aquí observaciones sobre el cliente, instrucciones de entrega frecuentes, acuerdos de pago especiales..."
          className="w-full h-48 px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
        />
        <div className="mt-4 flex justify-end items-center gap-3">
          {guardado && <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Guardado</span>}
          <button
            onClick={guardar}
            disabled={guardando || notas === (cliente.notas_internas || '')}
            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition"
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar Notas'}
          </button>
        </div>
      </div>
    </div>
  )
}
