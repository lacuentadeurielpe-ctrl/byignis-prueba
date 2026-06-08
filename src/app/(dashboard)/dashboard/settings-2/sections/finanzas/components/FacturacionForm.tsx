'use client'

import { useState, useEffect } from 'react'
import { FileText } from 'lucide-react'
import FormSection from '../../../components/FormSection'
import { useSettingsSave } from '../../../utils/settingsHooks'

interface FacturacionFormData {
  ruc?: string
  razon_social?: string
  nombre_comercial?: string
  tipo_ruc?: 'sin_ruc' | 'ruc10' | 'ruc20'
  regimen_tributario?: 'rer' | 'rmt' | 'rus' | 'general'
  serie_boletas?: string
  serie_facturas?: string
  igv_incluido_en_precios?: boolean
  representante_legal_nombre?: string
  representante_legal_dni?: string
  representante_legal_cargo?: string
  nubefact_modo?: 'prueba' | 'produccion'
}

const REGIMENES = [
  { id: 'rer', label: 'Régimen Especial (RER)' },
  { id: 'rmt', label: 'Régimen MYPE Tributario (RMT)' },
  { id: 'rus', label: 'Régimen Único Simplificado (RUS)' },
  { id: 'general', label: 'Régimen General' },
]

export default function FacturacionForm() {
  const { save, isSaving, error } = useSettingsSave()
  const [data, setData] = useState<FacturacionFormData>({})
  const [isDirty, setIsDirty] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/finanzas/facturacion')
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

  const handleChange = (field: string, value: any) => {
    setData(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }

  const handleSave = async () => {
    // Validar RUC/tipo
    if (data.tipo_ruc === 'ruc10' && data.ruc && data.ruc.length !== 10) {
      alert('RUC debe tener 10 dígitos')
      return
    }
    if (data.tipo_ruc === 'ruc20' && data.ruc && data.ruc.length !== 11) {
      alert('RUC debe tener 11 dígitos')
      return
    }

    await save(data, '/api/settings-2/finanzas/facturacion')
    setIsDirty(false)
  }

  if (loading) return <div className="text-sm text-zinc-500">Cargando...</div>

  return (
    <FormSection
      title="Configuración de Facturas"
      description="Datos tributarios y series de comprobantes"
      icon={<FileText className="w-5 h-5" />}
      onSave={handleSave}
      onCancel={() => setIsDirty(false)}
      isSaving={isSaving}
      isDirty={isDirty}
    >
      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">{error}</div>}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Tipo de RUC</label>
          <select
            value={data.tipo_ruc || 'sin_ruc'}
            onChange={e => handleChange('tipo_ruc', e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="sin_ruc">Sin RUC</option>
            <option value="ruc10">RUC 10 dígitos</option>
            <option value="ruc20">RUC 11 dígitos</option>
          </select>
        </div>

        {data.tipo_ruc !== 'sin_ruc' && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">RUC</label>
            <input
              type="text"
              value={data.ruc || ''}
              onChange={e => handleChange('ruc', e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={data.tipo_ruc === 'ruc10' ? '10 dígitos' : '11 dígitos'}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Razón Social</label>
          <input
            type="text"
            value={data.razon_social || ''}
            onChange={e => handleChange('razon_social', e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Nombre legal"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Nombre Comercial</label>
          <input
            type="text"
            value={data.nombre_comercial || ''}
            onChange={e => handleChange('nombre_comercial', e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Nombre de marca"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Régimen Tributario</label>
          <select
            value={data.regimen_tributario || 'general'}
            onChange={e => handleChange('regimen_tributario', e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {REGIMENES.map(r => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Serie Boletas (ej: B001)</label>
            <input
              type="text"
              value={data.serie_boletas || ''}
              onChange={e => handleChange('serie_boletas', e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Serie Facturas (ej: F001)</label>
            <input
              type="text"
              value={data.serie_facturas || ''}
              onChange={e => handleChange('serie_facturas', e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="border-t border-zinc-200 pt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={data.igv_incluido_en_precios || false}
              onChange={e => handleChange('igv_incluido_en_precios', e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300"
            />
            <span className="text-sm text-zinc-700">IGV incluido en precios (no sumar)</span>
          </label>
        </div>

        <div>
          <h4 className="font-medium text-sm text-zinc-900 mb-3">Representante Legal</h4>
          <div className="space-y-3">
            <input
              type="text"
              value={data.representante_legal_nombre || ''}
              onChange={e => handleChange('representante_legal_nombre', e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Nombre"
            />
            <input
              type="text"
              value={data.representante_legal_dni || ''}
              onChange={e => handleChange('representante_legal_dni', e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="DNI"
            />
            <input
              type="text"
              value={data.representante_legal_cargo || ''}
              onChange={e => handleChange('representante_legal_cargo', e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Cargo (ej: Gerente General)"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Modo Nubefact</label>
          <select
            value={data.nubefact_modo || 'prueba'}
            onChange={e => handleChange('nubefact_modo', e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="prueba">Pruebas (sandbox)</option>
            <option value="produccion">Producción</option>
          </select>
          <p className="text-xs text-zinc-500 mt-1">Cambia a Producción cuando hayas probado todo</p>
        </div>
      </div>
    </FormSection>
  )
}
