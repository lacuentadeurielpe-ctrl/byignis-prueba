'use client'

import { useState, useEffect } from 'react'
import { Building2 } from 'lucide-react'
import FormSection from '../../../components/FormSection'
import { useSettingsSave } from '../../../utils/settingsHooks'

interface GeneralFormData {
  nombre?: string
  telefono_whatsapp?: string
  direccion?: string
  email?: string
  logo_url?: string
  color_comprobante?: string
}

export default function GeneralForm() {
  const { save, isSaving, error } = useSettingsSave()
  const [data, setData] = useState<GeneralFormData>({})
  const [isDirty, setIsDirty] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/negocio/general')
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

  const handleChange = (field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }

  const handleSave = async () => {
    await save(data, '/api/settings-2/negocio/general')
    setIsDirty(false)
  }

  if (loading) return <div className="text-sm text-zinc-500">Cargando...</div>

  return (
    <FormSection
      title="Información General"
      description="Datos principales de tu ferretería"
      icon={<Building2 className="w-5 h-5" />}
      onSave={handleSave}
      onCancel={() => setIsDirty(false)}
      isSaving={isSaving}
      isDirty={isDirty}
    >
      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">{error}</div>}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Nombre de ferretería *</label>
          <input
            type="text"
            value={data.nombre || ''}
            onChange={e => handleChange('nombre', e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Ej: Ferretería El Maestro"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Teléfono WhatsApp *</label>
          <input
            type="text"
            value={data.telefono_whatsapp || ''}
            onChange={e => handleChange('telefono_whatsapp', e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Ej: 51987654321 (sin +)"
          />
          <p className="text-xs text-zinc-500 mt-1">Formato: número sin + (ej: 51987654321)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Dirección</label>
          <input
            type="text"
            value={data.direccion || ''}
            onChange={e => handleChange('direccion', e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Ej: Av. Principal 123, Lima"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Email</label>
          <input
            type="email"
            value={data.email || ''}
            onChange={e => handleChange('email', e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="contacto@ferreteria.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Logo URL</label>
          <input
            type="text"
            value={data.logo_url || ''}
            onChange={e => handleChange('logo_url', e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Color Comprobantes</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={data.color_comprobante || '#6366f1'}
              onChange={e => handleChange('color_comprobante', e.target.value)}
              className="w-12 h-10 rounded cursor-pointer"
            />
            <span className="text-xs text-zinc-500">Para PDF de facturas/boletas</span>
          </div>
        </div>
      </div>
    </FormSection>
  )
}
