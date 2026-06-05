'use client'

import { useState } from 'react'
import { Package2 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  unidadBase: string
  onSave: (conversion: { unidadCompra: string; factor: number }) => void
}

export default function ConversionPaqueteModal({ open, onClose, unidadBase, onSave }: Props) {
  const [unidadCompra, setUnidadCompra] = useState('caja')
  const [factor, setFactor] = useState('12')

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const factorNum = parseFloat(factor)
    if (!unidadCompra.trim()) {
      alert('Especifica el nombre de la unidad de compra (ej: caja, paquete)')
      return
    }
    if (isNaN(factorNum) || factorNum <= 0) {
      alert('El factor de conversión debe ser un número mayor a 0')
      return
    }

    onSave({
      unidadCompra: unidadCompra.trim(),
      factor: factorNum,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-zinc-100 border border-zinc-200 rounded-xl flex items-center justify-center">
            <Package2 className="w-5 h-5 text-zinc-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-950">Conversión de Paquete → Unidad</h3>
            <p className="text-xs text-zinc-400">Define cuántas unidades vienen en la caja</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">
              Unidad de compra (Ej: caja, paquete, bolsa, fardo)
            </label>
            <input
              value={unidadCompra}
              onChange={(e) => setUnidadCompra(e.target.value)}
              placeholder="Ej: caja"
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">
              Factor de conversión
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium whitespace-nowrap">1 {unidadCompra || 'paquete'} = </span>
              <input
                type="number"
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
                min="0.001"
                step="any"
                className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 transition font-bold"
                required
              />
              <span className="text-xs text-zinc-500 font-semibold">{unidadBase}(s)</span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              Ejemplo: Si compras una caja de tornillos que trae 100 tornillos sueltos, la unidad de compra es &ldquo;caja&rdquo; y el factor es &ldquo;100&rdquo;.
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-zinc-500 hover:bg-zinc-50 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white text-xs font-semibold rounded-xl transition"
            >
              Aplicar conversión
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
