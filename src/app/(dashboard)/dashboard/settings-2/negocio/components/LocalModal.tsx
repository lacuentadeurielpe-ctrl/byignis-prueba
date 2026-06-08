'use client'

import { useState, useEffect } from 'react'
import { X, MapPin, Clock, Phone, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import LocalMapPicker from './LocalMapPicker'
import type { Local, LocalFormData, DIAS_SEMANA } from '@/types/locales'
import { DIAS_SEMANA_LABELS } from '@/types/locales'

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
  })
  const [isSaving, setIsSaving] = useState(false)
  const [hasCoordinates, setHasCoordinates] = useState(!!local?.lat && !!local?.lng)

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
    if (!formData.direccion.trim()) {
      toast.error('La dirección es requerida')
      return
    }

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
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-200">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {local ? 'Editar local' : 'Crear nuevo local'}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {local ? 'Actualiza la información' : 'Agrega un nuevo local a tu ferretería'}
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
        <div className="p-6 space-y-6">
          {/* Nombre y Código */}
          <div className="grid grid-cols-2 gap-4">
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

          {/* Dirección y ubicación con mapa interactivo */}
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

            <div className="grid grid-cols-2 gap-3 mb-4">
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
              <div className="grid grid-cols-4 gap-2">
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
        <div className="sticky bottom-0 bg-white border-t border-zinc-200 px-6 py-4 flex gap-3">
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
