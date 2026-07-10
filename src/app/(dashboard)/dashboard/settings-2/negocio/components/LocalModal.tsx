'use client'

import { useState, useEffect } from 'react'
import { X, MapPin, Clock, Phone, Tag, FileText, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import LocalMapPicker from './LocalMapPicker'
import type { Local, LocalFormData, DIAS_SEMANA } from '@/types/locales'
import { DIAS_SEMANA_LABELS } from '@/types/locales'
import { getDepartments, getProvinces, getDistricts, getUbigeoData, validateUbigeo } from 'ubigeo-fns'

interface LocalModalProps {
  local?: Local
  onClose: () => void
  onSuccess: (local: Local) => void
}

const DIAS_SEMANA_ARR: (typeof DIAS_SEMANA)[number][] = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
]

export default function LocalModal({ local, onClose, onSuccess }: LocalModalProps) {
  const [formData, setFormData] = useState<LocalFormData>({
    nombre: local?.nombre || '',
    codigo: local?.codigo || '',
    descripcion: local?.descripcion || '',
    direccion: local?.direccion || '',
    lat: local?.lat,
    lng: local?.lng,
    place_id: local?.place_id,
    telefono: local?.telefono || '',
    horario_apertura: local?.horario_apertura || '08:00',
    horario_cierre: local?.horario_cierre || '18:00',
    dias_atencion: local?.dias_atencion || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
    es_principal: local?.es_principal || false,
    codigo_sunat: local?.codigo_sunat || '0000',
    serie_boletas: local?.serie_boletas || '',
    serie_facturas: local?.serie_facturas || '',
    ubigeo: local?.ubigeo || '',
    departamento: local?.departamento || '',
    provincia: local?.provincia || '',
    distrito: local?.distrito || '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [hasCoordinates, setHasCoordinates] = useState(!!local?.lat && !!local?.lng)

  const [deptCode, setDeptCode] = useState(local?.departamento || '')
  const [provCode, setProvCode] = useState(local?.provincia || '')
  const [distCode, setDistCode] = useState(local?.distrito || '')

  useEffect(() => {
    if (local?.ubigeo) {
      const uData = getUbigeoData(local.ubigeo)
      if (uData) {
        setDeptCode(uData.department || '')
        setProvCode(uData.province || '')
        setDistCode(uData.district || '')
      }
    }
  }, [local])

  const handleDeptChange = (newDeptCode: string) => {
    setDeptCode(newDeptCode)
    setProvCode('')
    setDistCode('')
    setFormData(prev => ({
      ...prev,
      departamento: newDeptCode,
      provincia: '',
      distrito: '',
      ubigeo: ''
    }))
  }

  const handleProvChange = (newProvCode: string) => {
    setProvCode(newProvCode)
    setDistCode('')
    setFormData(prev => ({
      ...prev,
      provincia: newProvCode,
      distrito: '',
      ubigeo: ''
    }))
  }

  const handleDistChange = (newDistCode: string) => {
    setDistCode(newDistCode)
    if (!newDistCode) {
      setFormData(prev => ({ ...prev, ubigeo: '', distrito: '' }))
    } else {
      const uData = getUbigeoData(newDistCode)
      setFormData(prev => ({
        ...prev,
        ubigeo: newDistCode,
        departamento: uData?.department || prev.departamento,
        provincia: uData?.province || prev.provincia,
        distrito: uData?.district || prev.distrito,
      }))
    }
  }

  const handleUbigeoChange = (val: string) => {
    const rawVal = val.replace(/\D/g, '').substring(0, 6)
    if (rawVal.length === 6 && validateUbigeo(rawVal)) {
      const uData = getUbigeoData(rawVal)
      setDeptCode(uData?.department || '')
      setProvCode(uData?.province || '')
      setDistCode(uData?.district || '')
      setFormData(prev => ({
        ...prev,
        ubigeo: rawVal,
        departamento: uData?.department || prev.departamento,
        provincia: uData?.province || prev.provincia,
        distrito: uData?.district || prev.distrito,
      }))
    } else {
      setFormData(prev => ({ ...prev, ubigeo: rawVal }))
    }
  }

  const handleChange = (field: keyof LocalFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleDia = (dia: (typeof DIAS_SEMANA)[number]) => {
    setFormData(prev => ({
      ...prev,
      dias_atencion: prev.dias_atencion?.includes(dia)
        ? prev.dias_atencion.filter(d => d !== dia)
        : [...(prev.dias_atencion || []), dia],
    }))
  }

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      toast.error('El nombre del local es requerido')
      return
    }
    // Dirección es OPCIONAL - para negocios digitales

    setIsSaving(true)
    try {
      const url = local
        ? `/api/settings-2/negocio/locales/${local.id}`
        : '/api/settings-2/negocio/locales'
      const method = local ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `Error al ${local ? 'actualizar' : 'crear'} local`)
      }

      const result = await res.json()
      toast.success(`Local ${local ? 'actualizado' : 'creado'} exitosamente`)
      onSuccess(result)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center md:items-end z-50 p-4 md:p-0">
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-4xl bg-white md:rounded-2xl rounded-t-3xl shadow-2xl overflow-y-auto max-h-[90vh] max-h-screen md:max-h-[90vh]"
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-200">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {local ? 'Editar local' : 'Crear nuevo local'}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {local ? 'Actualiza la información' : 'Agrega un nuevo local a tu negocio'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-visible">
          {/* Nombre y Código */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Nombre del local *
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={e => handleChange('nombre', e.target.value)}
                placeholder="Ej: Local Principal"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2 flex items-center gap-2">
                <Tag className="w-4 h-4" /> Código
              </label>
              <input
                type="text"
                value={formData.codigo || ''}
                onChange={e => handleChange('codigo', e.target.value)}
                placeholder="Ej: L1, SUC-NORTE"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Descripción</label>
            <textarea
              value={formData.descripcion || ''}
              onChange={e => handleChange('descripcion', e.target.value)}
              placeholder="Notas internas sobre este local..."
              rows={2}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Dirección y ubicación */}
          <div>
            <p className="text-xs text-zinc-500 mb-3 italic">
              💡 La ubicación es opcional, pero importante si haces entregas o emites comprobantes desde aquí.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                  value={formData.ubigeo || ''}
                  onChange={e => handleUbigeoChange(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="Ej: 150101"
                  maxLength={6}
                />
              </div>
            </div>

            <LocalMapPicker
            onLocationChange={result => {
              handleChange('direccion', result.direccion)
              handleChange('lat', result.lat)
              handleChange('lng', result.lng)
              handleChange('place_id', result.place_id)
              setHasCoordinates(true)
            }}
            initialDireccion={formData.direccion}
            initialLat={formData.lat}
            initialLng={formData.lng}
            autoSave={true}
          />
          </div>

          {/* Contacto */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2 flex items-center gap-2">
              <Phone className="w-4 h-4" /> Teléfono
            </label>
            <input
              type="text"
              value={formData.telefono || ''}
              onChange={e => handleChange('telefono', e.target.value)}
              placeholder="51987654321 (sin +)"
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-zinc-500 mt-1">Teléfono específico de este local (opcional)</p>
          </div>

          {/* Horarios */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Horario de atención
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-zinc-600 mb-1.5 block">Apertura</label>
                <input
                  type="time"
                  value={formData.horario_apertura}
                  onChange={e => handleChange('horario_apertura', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-600 mb-1.5 block">Cierre</label>
                <input
                  type="time"
                  value={formData.horario_cierre}
                  onChange={e => handleChange('horario_cierre', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-zinc-600 font-medium">Días de atención</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {DIAS_SEMANA_ARR.map(dia => (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => toggleDia(dia)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all border ${
                      formData.dias_atencion?.includes(dia)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    {DIAS_SEMANA_LABELS[dia]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Facturación SUNAT por sucursal */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Facturación electrónica (opcional)
            </label>
            <p className="text-xs text-zinc-500 mb-3">
              Si este local emite con series propias, decláralas aquí. Vacío = usa las series
              generales del negocio. El código de establecimiento sale de tu Ficha RUC.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-zinc-600 mb-1.5 block">Cód. establecimiento</label>
                <input
                  type="text"
                  value={formData.codigo_sunat || ''}
                  onChange={e => handleChange('codigo_sunat', e.target.value)}
                  placeholder="0000"
                  maxLength={4}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-600 mb-1.5 block">Serie boletas</label>
                <input
                  type="text"
                  value={formData.serie_boletas || ''}
                  onChange={e => handleChange('serie_boletas', e.target.value.toUpperCase())}
                  placeholder="B002"
                  maxLength={4}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-600 mb-1.5 block">Serie facturas</label>
                <input
                  type="text"
                  value={formData.serie_facturas || ''}
                  onChange={e => handleChange('serie_facturas', e.target.value.toUpperCase())}
                  placeholder="F002"
                  maxLength={4}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Principal */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.es_principal || false}
                onChange={e => handleChange('es_principal', e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer text-indigo-600"
              />
              <div>
                <p className="text-sm font-medium text-blue-900">Marcar como local principal</p>
                <p className="text-xs text-blue-700">Este será el local predeterminado para el bot</p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-zinc-200 px-6 py-4 flex gap-3 flex-col-reverse sm:flex-row">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Guardando...' : `${local ? 'Actualizar' : 'Crear'} local`}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
