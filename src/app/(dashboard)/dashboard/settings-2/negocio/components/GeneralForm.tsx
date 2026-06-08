'use client'

import { useState, useEffect } from 'react'
import { Building2, Upload } from 'lucide-react'
import FormSection from '../../components/FormSection'
import { useSettingsSave } from '../../utils/settingsHooks'

interface GeneralFormData {
  nombre?: string
  telefono_whatsapp?: string
  direccion?: string
  email?: string
  logo_url?: string
  color_comprobante?: string
  tipo_establecimiento?: string
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
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Sección 1: Datos básicos */}
        <div className="border-b border-zinc-200 pb-6">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4">📋 Datos básicos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Nombre de ferretería *
              </label>
              <input
                type="text"
                value={data.nombre || ''}
                onChange={e => handleChange('nombre', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ej: Ferretería El Maestro"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Tipo de establecimiento
              </label>
              <select
                value={data.tipo_establecimiento || 'ferreteria'}
                onChange={e => handleChange('tipo_establecimiento', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ferreteria">Ferretería</option>
                <option value="mayorista">Mayorista</option>
                <option value="minorista">Minorista</option>
                <option value="distribuidor">Distribuidor</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Teléfono WhatsApp *
              </label>
              <input
                type="text"
                value={data.telefono_whatsapp || ''}
                onChange={e => handleChange('telefono_whatsapp', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ej: 51987654321"
              />
              <p className="text-xs text-zinc-500 mt-1">Sin + (formato: 51987654321)</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Dirección
              </label>
              <input
                type="text"
                value={data.direccion || ''}
                onChange={e => handleChange('direccion', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ej: Av. Principal 123, Lima, Perú"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-2">Email</label>
              <input
                type="email"
                value={data.email || ''}
                onChange={e => handleChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="contacto@ferreteria.com"
              />
            </div>
          </div>
        </div>

        {/* Sección 2: Marca y presentación */}
        <div className="border-b border-zinc-200 pb-6">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4">🎨 Marca y presentación</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Logo URL
              </label>
              <input
                type="text"
                value={data.logo_url || ''}
                onChange={e => handleChange('logo_url', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://tu-dominio.com/logo.png"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Usado en PDF de facturas, emails y reportes
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Color comprobantes
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={data.color_comprobante || '#6366f1'}
                  onChange={e => handleChange('color_comprobante', e.target.value)}
                  className="w-14 h-10 rounded cursor-pointer border border-zinc-200"
                />
                <span className="text-xs text-zinc-500">
                  Usado en facturas y boletas PDF
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Nota informativa */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-900 font-medium mb-1">💡 Información importante:</p>
          <ul className="text-xs text-blue-800 space-y-1 ml-4">
            <li>• Los datos generales se usan en comprobantes (facturas/boletas)</li>
            <li>• El RUC es necesario para emisión de facturas SUNAT</li>
            <li>• El teléfono WhatsApp es el canal principal del bot</li>
            <li>
              • Para más detalles de locales específicos, ve a la sección{' '}
              <span className="font-medium">Locales</span>
            </li>
          </ul>
        </div>
      </div>
    </FormSection>
  )
}
