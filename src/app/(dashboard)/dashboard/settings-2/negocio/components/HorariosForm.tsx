'use client'

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import FormSection from '../../components/FormSection'
import { useSettingsSave } from '../../utils/settingsHooks'

interface HorariosFormData {
  dias_atencion?: string[]
  horario_apertura?: string
  horario_cierre?: string
  mensaje_bienvenida?: string
  mensaje_fuera_horario?: string
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export default function HorariosForm() {
  const { save, isSaving, error } = useSettingsSave()
  const [data, setData] = useState<HorariosFormData>({})
  const [isDirty, setIsDirty] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/negocio/horarios')
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

  const handleDiaChange = (dia: string, checked: boolean) => {
    const dias = data.dias_atencion || []
    const updated = checked ? [...dias, dia] : dias.filter(d => d !== dia)
    setData(prev => ({ ...prev, dias_atencion: updated }))
    setIsDirty(true)
  }

  const handleChange = (field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }

  const handleSave = async () => {
    await save(data, '/api/settings-2/negocio/horarios')
    setIsDirty(false)
  }

  if (loading) return <div className="text-sm text-zinc-500">Cargando...</div>

  return (
    <FormSection
      title="Horarios & Atención"
      description="Configura cuándo atiende tu tienda"
      icon={<Clock className="w-5 h-5" />}
      onSave={handleSave}
      onCancel={() => setIsDirty(false)}
      isSaving={isSaving}
      isDirty={isDirty}
    >
      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">{error}</div>}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-3">Días de atención</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {DIAS.map(dia => (
              <label key={dia} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(data.dias_atencion || []).includes(dia)}
                  onChange={e => handleDiaChange(dia, e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300"
                />
                <span className="text-sm text-zinc-700">{dia}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Hora apertura</label>
            <input
              type="time"
              value={data.horario_apertura || ''}
              onChange={e => handleChange('horario_apertura', e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Hora cierre</label>
            <input
              type="time"
              value={data.horario_cierre || ''}
              onChange={e => handleChange('horario_cierre', e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Mensaje de bienvenida WhatsApp</label>
          <textarea
            value={data.mensaje_bienvenida || ''}
            onChange={e => handleChange('mensaje_bienvenida', e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            rows={2}
            placeholder="Ej: Hola, bienvenido a nuestro catálogo..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Mensaje fuera de horario</label>
          <textarea
            value={data.mensaje_fuera_horario || ''}
            onChange={e => handleChange('mensaje_fuera_horario', e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            rows={2}
            placeholder="Ej: Estamos cerrados, abrimos mañana a las 8am..."
          />
        </div>
      </div>
    </FormSection>
  )
}
