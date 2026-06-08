'use client'

import { useState, useEffect } from 'react'
import { CreditCard } from 'lucide-react'
import FormSection from '../../components/FormSection'
import { useSettingsSave } from '../../utils/settingsHooks'

interface PagosFormData {
  metodos_pago_activos?: string[]
  datos_yape?: { numero?: string; qr_url?: string }
  datos_plin?: { numero?: string; nombre?: string }
  datos_transferencia?: { banco?: string; cuenta?: string; cci?: string; titular?: string }
}

const METODOS = [
  { id: 'efectivo', label: 'Efectivo', icon: 'ðŸ’µ' },
  { id: 'yape', label: 'Yape', icon: 'ðŸ“±' },
  { id: 'plin', label: 'Plin', icon: 'ðŸ“±' },
  { id: 'transferencia', label: 'Transferencia', icon: 'ðŸ¦' },
  { id: 'mercadopago', label: 'Mercado Pago', icon: 'ðŸ’³' },
]

export default function PagosMetodosForm() {
  const { save, isSaving, error } = useSettingsSave()
  const [data, setData] = useState<PagosFormData>({})
  const [isDirty, setIsDirty] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/negocio/pagos')
        if (res.ok) {
          const result = await res.json()
          setData(result)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleMetodoChange = (metodo: string, checked: boolean) => {
    const metodos = data.metodos_pago_activos || []
    const updated = checked ? [...metodos, metodo] : metodos.filter(m => m !== metodo)
    setData(prev => ({ ...prev, metodos_pago_activos: updated }))
    setIsDirty(true)
  }

  const handleNestedChange = (group: string, field: string, value: string) => {
    setData(prev => ({
      ...prev,
      [`datos_${group}`]: { ...(prev[`datos_${group}` as keyof PagosFormData] as any), [field]: value },
    }))
    setIsDirty(true)
  }

  const handleSave = async () => {
    await save(data, '/api/settings-2/negocio/pagos')
    setIsDirty(false)
  }

  if (loading) return <div className="text-sm text-zinc-500">Cargando...</div>

  const isYapeActive = (data.metodos_pago_activos || []).includes('yape')
  const isPlinActive = (data.metodos_pago_activos || []).includes('plin')
  const isTransferActive = (data.metodos_pago_activos || []).includes('transferencia')

  return (
    <FormSection
      title="MÃ©todos de Pago"
      description="Configura cÃ³mo aceptas pagos"
      icon={<CreditCard className="w-5 h-5" />}
      onSave={handleSave}
      onCancel={() => setIsDirty(false)}
      isSaving={isSaving}
      isDirty={isDirty}
    >
      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">{error}</div>}

      <div className="space-y-6">
        {/* MÃ©todos disponibles */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-3">MÃ©todos disponibles</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {METODOS.map(metodo => (
              <label key={metodo.id} className="flex items-center gap-2 p-3 border border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-50">
                <input
                  type="checkbox"
                  checked={(data.metodos_pago_activos || []).includes(metodo.id)}
                  onChange={e => handleMetodoChange(metodo.id, e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300"
                />
                <span className="text-sm text-zinc-700">
                  {metodo.icon} {metodo.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Yape */}
        {isYapeActive && (
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3">
            <h4 className="font-medium text-indigo-900">ConfiguraciÃ³n Yape</h4>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">NÃºmero Yape</label>
              <input
                type="text"
                value={data.datos_yape?.numero || ''}
                onChange={e => handleNestedChange('yape', 'numero', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="NÃºmero de telÃ©fono"
              />
            </div>
          </div>
        )}

        {/* Plin */}
        {isPlinActive && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
            <h4 className="font-medium text-blue-900">ConfiguraciÃ³n Plin</h4>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">NÃºmero Plin</label>
              <input
                type="text"
                value={data.datos_plin?.numero || ''}
                onChange={e => handleNestedChange('plin', 'numero', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="NÃºmero de telÃ©fono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Nombre</label>
              <input
                type="text"
                value={data.datos_plin?.nombre || ''}
                onChange={e => handleNestedChange('plin', 'nombre', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Nombre de titular"
              />
            </div>
          </div>
        )}

        {/* Transferencia */}
        {isTransferActive && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
            <h4 className="font-medium text-emerald-900">Datos Bancarios</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Banco</label>
                <input
                  type="text"
                  value={data.datos_transferencia?.banco || ''}
                  onChange={e => handleNestedChange('transferencia', 'banco', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ej: BCP"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">NÃºmero Cuenta</label>
                <input
                  type="text"
                  value={data.datos_transferencia?.cuenta || ''}
                  onChange={e => handleNestedChange('transferencia', 'cuenta', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">CCI</label>
              <input
                type="text"
                value={data.datos_transferencia?.cci || ''}
                onChange={e => handleNestedChange('transferencia', 'cci', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Titular</label>
              <input
                type="text"
                value={data.datos_transferencia?.titular || ''}
                onChange={e => handleNestedChange('transferencia', 'titular', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}
      </div>
    </FormSection>
  )
}
