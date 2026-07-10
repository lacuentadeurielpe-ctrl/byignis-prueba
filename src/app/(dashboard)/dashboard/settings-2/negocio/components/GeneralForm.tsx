'use client'

import { useState, useEffect } from 'react'
import { Building2, Upload, ChevronDown } from 'lucide-react'
import FormSection from '../../components/FormSection'
import { useSettingsSave } from '../../utils/settingsHooks'
import { getDepartments, getProvinces, getDistricts, parseUbigeo, getUbigeoData, validateUbigeo } from 'ubigeo-fns'

interface GeneralFormData {
  nombre?: string
  telefono_whatsapp?: string
  direccion?: string
  email?: string
  logo_url?: string
  color_comprobante?: string
  tipo_establecimiento?: string
  ruc?: string
  mensaje_comprobante?: string
  ubigeo?: string
  departamento?: string
  provincia?: string
  distrito?: string
}

export default function GeneralForm() {
  const { save, isSaving, error } = useSettingsSave()
  const [data, setData] = useState<GeneralFormData>({})
  const [isDirty, setIsDirty] = useState(false)
  const [loading, setLoading] = useState(true)

  const [deptCode, setDeptCode] = useState('')
  const [provCode, setProvCode] = useState('')
  const [distCode, setDistCode] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/negocio/general')
        if (res.ok) {
          const result = await res.json()
          setData(result)

          let dCode = ''
          let pCode = ''
          let dtCode = ''

          if (result.ubigeo) {
            const parsed = parseUbigeo(result.ubigeo)
            dCode = parsed?.departmentCode || ''
            pCode = parsed?.provinceCode || ''
            dtCode = parsed?.districtCode || ''
          } else if (result.departamento) {
            dCode = getDepartments().find(d => d.name === result.departamento)?.code || ''
          }

          setDeptCode(dCode)
          setProvCode(pCode)
          setDistCode(dtCode)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleChange = (field: keyof GeneralFormData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }

  const handleDeptChange = (newDeptCode: string) => {
    setDeptCode(newDeptCode)
    setProvCode('')
    setDistCode('')

    if (!newDeptCode) {
      setData(prev => ({ ...prev, ubigeo: '', departamento: '', provincia: '', distrito: '' }))
    } else {
      const depts = getDepartments()
      const deptName = depts.find(d => d.code === newDeptCode)?.name || ''
      setData(prev => ({ ...prev, departamento: deptName, provincia: '', distrito: '', ubigeo: '' }))
    }
    setIsDirty(true)
  }

  const handleProvChange = (newProvCode: string) => {
    setProvCode(newProvCode)
    setDistCode('')

    if (!newProvCode) {
      setData(prev => ({ ...prev, ubigeo: '', provincia: '', distrito: '' }))
    } else {
      const provs = getProvinces(deptCode)
      const provName = provs.find(p => p.code === newProvCode)?.name || ''
      setData(prev => ({ ...prev, provincia: provName, distrito: '', ubigeo: '' }))
    }
    setIsDirty(true)
  }

  const handleDistChange = (newDistCode: string) => {
    setDistCode(newDistCode)
    if (!newDistCode) {
      setData(prev => ({ ...prev, ubigeo: '', distrito: '' }))
    } else {
      const uData = getUbigeoData(newDistCode)
      setData(prev => ({
        ...prev,
        ubigeo: newDistCode,
        departamento: uData?.department || prev.departamento,
        provincia: uData?.province || prev.provincia,
        distrito: uData?.district || prev.distrito,
      }))
    }
    setIsDirty(true)
  }

  const handleUbigeoChange = (val: string) => {
    const rawVal = val.replace(/\D/g, '').substring(0, 6)
    if (rawVal.length === 6 && validateUbigeo(rawVal)) {
      const parsed = parseUbigeo(rawVal)
      if (parsed) {
        setDeptCode(parsed.departmentCode || '')
        setProvCode(parsed.provinceCode || '')
        setDistCode(parsed.districtCode || '')
      }
      const uData = getUbigeoData(rawVal)
      setData(prev => ({
        ...prev,
        ubigeo: rawVal,
        departamento: uData?.department || prev.departamento,
        provincia: uData?.province || prev.provincia,
        distrito: uData?.district || prev.distrito,
      }))
    } else {
      setData(prev => ({ ...prev, ubigeo: rawVal }))
    }
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
      description="Datos principales de tu negocio"
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
                Nombre del negocio *
              </label>
              <input
                type="text"
                value={data.nombre || ''}
                onChange={e => handleChange('nombre', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ej: Don Mario Suministros"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Tipo de establecimiento
              </label>
              <div className="relative">
                <select
                  value={data.tipo_establecimiento || 'ferreteria'}
                  onChange={e => handleChange('tipo_establecimiento', e.target.value)}
                  className="w-full appearance-none px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white pr-10"
                >
                  <option value="ferreteria">Negocio / Tienda</option>
                  <option value="mayorista">Mayorista</option>
                  <option value="minorista">Minorista</option>
                  <option value="distribuidor">Distribuidor</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
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
                Dirección Fiscal
              </label>
              <input
                type="text"
                value={data.direccion || ''}
                onChange={e => handleChange('direccion', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ej: Av. Principal 123"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Departamento
              </label>
              <div className="relative">
                <select
                  value={deptCode}
                  onChange={e => handleDeptChange(e.target.value)}
                  className="w-full appearance-none px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white pr-10"
                >
                  <option value="">Seleccione...</option>
                  {getDepartments().map(d => (
                    <option key={d.code} value={d.code}>{d.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Provincia
              </label>
              <div className="relative">
                <select
                  value={provCode}
                  onChange={e => handleProvChange(e.target.value)}
                  disabled={!deptCode}
                  className="w-full appearance-none px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:opacity-50 pr-10"
                >
                  <option value="">Seleccione...</option>
                  {deptCode && getProvinces(deptCode).map(p => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Distrito
              </label>
              <div className="relative">
                <select
                  value={distCode}
                  onChange={e => handleDistChange(e.target.value)}
                  disabled={!provCode}
                  className="w-full appearance-none px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:opacity-50 pr-10"
                >
                  <option value="">Seleccione...</option>
                  {provCode && getDistricts(provCode).map(d => (
                    <option key={d.code} value={d.code}>{d.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Código Ubigeo
              </label>
              <input
                type="text"
                value={data.ubigeo || ''}
                onChange={e => handleUbigeoChange(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                placeholder="Ej: 150101"
                maxLength={6}
              />
              <p className="text-xs text-zinc-500 mt-1">
                Escribe 6 dígitos para autocompletar, o usa las listas de arriba.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-2">Email</label>
              <input
                type="email"
                value={data.email || ''}
                onChange={e => handleChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="contacto@minegocio.com"
              />
            </div>
          </div>
        </div>

        {/* Sección 1b: Datos fiscales */}
        <div className="border-b border-zinc-200 pb-6">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4">🧾 Datos fiscales</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                RUC
              </label>
              <input
                type="text"
                value={data.ruc || ''}
                onChange={e => handleChange('ruc', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ej: 20123456789"
                maxLength={11}
              />
              <p className="text-xs text-zinc-500 mt-1">Aparece en el encabezado del PDF</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Mensaje pie de página (comprobantes)
              </label>
              <textarea
                value={data.mensaje_comprobante || ''}
                onChange={e => handleChange('mensaje_comprobante', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Ej: ¡Gracias por elegirnos! Garantía 30 días. Consultas al 51987654321"
              />
              <p className="text-xs text-zinc-500 mt-1">Texto opcional al pie de cada PDF generado</p>
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
