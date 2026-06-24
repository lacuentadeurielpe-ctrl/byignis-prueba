'use client'

import { useState, useEffect } from 'react'
import { MapPin, Plus, MoreVertical, Star, Clock, Phone, Edit2, Trash2, AlertCircle, Map } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import FormSection from '../../components/FormSection'
import LocalModal from './LocalModal'
import LocalesMapModal from './LocalesMapModal'
import DistanciaCalculator from './DistanciaCalculator'
import type { Local } from '@/types/locales'

export default function LocalesForm() {
  const [locales, setLocales] = useState<Local[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLocal, setEditingLocal] = useState<Local | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showMapModal, setShowMapModal] = useState(false)
  const [showDistanciaCalculator, setShowDistanciaCalculator] = useState(false)

  useEffect(() => {
    fetchLocales()
  }, [])

  const fetchLocales = async () => {
    try {
      const res = await fetch('/api/settings-2/negocio/locales')
      if (res.ok) {
        const data = await res.json()
        setLocales(data)
      }
    } catch (error) {
      console.error('Error fetching locales:', error)
      toast.error('Error al cargar los locales')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (local?: Local) => {
    setEditingLocal(local || null)
    setModalOpen(true)
    setOpenMenu(null)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingLocal(null)
  }

  const handleSuccess = (local: Local) => {
    if (editingLocal) {
      setLocales(prev => prev.map(l => (l.id === local.id ? local : l)))
      toast.success('Local actualizado')
    } else {
      setLocales(prev => [local, ...prev])
      toast.success('Local creado')
    }
    handleCloseModal()
  }

  const handleDelete = async (localId: string, nombre: string, esPrincipal: boolean) => {
    if (esPrincipal) {
      toast.error('No se puede eliminar el local principal')
      return
    }

    if (!confirm(`¿Eliminar "${nombre}"?`)) return

    setDeleting(localId)
    try {
      const res = await fetch(`/api/settings-2/negocio/locales/${localId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }

      setLocales(prev => prev.filter(l => l.id !== localId))
      toast.success('Local eliminado')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al eliminar')
    } finally {
      setDeleting(null)
      setOpenMenu(null)
    }
  }

  if (loading) {
    return <div className="text-sm text-zinc-500">Cargando locales...</div>
  }

  return (
    <>
      <FormSection
        title="📍 Locales"
        description="Gestiona todos los locales de tu negocio"
        icon={<MapPin className="w-5 h-5" />}
        onSave={() => {}}
        isDirty={false}
      >
        <div className="space-y-4">
          {locales.length === 0 ? (
            <div className="p-6 text-center border-2 border-dashed border-zinc-200 rounded-xl">
              <MapPin className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-zinc-700 mb-1">No tienes locales aún</p>
              <p className="text-xs text-zinc-500 mb-4">Crea tu primer local para empezar</p>
              <button
                onClick={() => handleOpenModal()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> Crear primer local
              </button>
            </div>
          ) : (
            <>
              {/* Botones de control */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => setShowMapModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                >
                  <Map className="w-4 h-4" /> Ver mapa
                </button>
                <button
                  onClick={() => setShowDistanciaCalculator(!showDistanciaCalculator)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors"
                >
                  <MapPin className="w-4 h-4" /> Calcular distancias
                </button>
              </div>

              {/* Calculadora de distancias (expandible) */}
              {showDistanciaCalculator && (
                <div className="p-4 border border-emerald-200 bg-emerald-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-emerald-900">📏 Calcular distancias</h3>
                    <button
                      onClick={() => setShowDistanciaCalculator(false)}
                      className="text-xs text-emerald-700 hover:text-emerald-900 underline"
                    >
                      Cerrar
                    </button>
                  </div>
                  <DistanciaCalculator locales={locales} />
                </div>
              )}

              <div className="space-y-3">
                <AnimatePresence>
                  {locales.map(local => (
                    <motion.div
                      key={local.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-4 md:p-6 border border-zinc-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all group relative"
                    >
                      {/* Header: Título + Badges + Menú */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {local.es_principal ? (
                            <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                              <Star className="w-5 h-5 text-amber-600 fill-amber-600" />
                            </div>
                          ) : (
                            <div className="p-2 bg-zinc-100 rounded-lg flex-shrink-0">
                              <MapPin className="w-5 h-5 text-zinc-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm md:text-base font-semibold text-zinc-900">{local.nombre}</h3>
                              {local.es_principal && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded flex-shrink-0">
                                  <Star className="w-3 h-3" /> Principal
                                </span>
                              )}
                              {!local.activo && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-600 text-xs font-medium rounded flex-shrink-0">
                                  Inactivo
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Menú - siempre visible */}
                        <div className="relative flex-shrink-0">
                          <button
                            onClick={() =>
                              setOpenMenu(openMenu === local.id ? null : local.id)
                            }
                            className="p-2 hover:bg-zinc-100 rounded-lg transition-all text-zinc-500 hover:text-zinc-700"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenu === local.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="absolute right-0 mt-1 w-40 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 overflow-hidden"
                            >
                              <button
                                onClick={() => handleOpenModal(local)}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 hover:bg-indigo-50 border-b border-zinc-100"
                              >
                                <Edit2 className="w-4 h-4" /> Editar
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  e.preventDefault()
                                  handleDelete(local.id, local.nombre, local.es_principal)
                                }}
                                disabled={deleting === local.id || local.es_principal}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                {deleting === local.id ? 'Eliminando...' : 'Eliminar'}
                              </button>
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {/* Dirección */}
                      {local.direccion && (
                        <p className="text-sm text-zinc-600 mb-3 ml-14 md:ml-0">{local.direccion}</p>
                      )}

                      {/* Detalles en grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ml-14 md:ml-0">
                        {local.telefono && (
                          <div className="flex items-center gap-2 text-xs text-zinc-600">
                            <Phone className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                            <span>{local.telefono}</span>
                          </div>
                        )}
                        {local.horario_apertura && local.horario_cierre && (
                          <div className="flex items-center gap-2 text-xs text-zinc-600">
                            <Clock className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                            <span>{local.horario_apertura} – {local.horario_cierre}</span>
                          </div>
                        )}
                        {local.lat && local.lng && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-emerald-600">✓ Ubicación exacta</span>
                          </div>
                        )}
                        {local.codigo && (
                          <div className="text-xs text-zinc-500">Código: <span className="font-mono">{local.codigo}</span></div>
                        )}
                      </div>

                      {!local.lat && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700">
                            Sin coordenadas. Edita para obtenerlas desde Google Maps.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Botón agregar */}
              <button
                onClick={() => handleOpenModal()}
                className="w-full mt-4 py-3 border-2 border-dashed border-zinc-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 text-indigo-600 font-medium text-sm"
              >
                <Plus className="w-4 h-4" /> Agregar otro local
              </button>
            </>
          )}
        </div>
      </FormSection>

      {/* Modales */}
      <AnimatePresence>
        {modalOpen && (
          <LocalModal
            local={editingLocal || undefined}
            onClose={handleCloseModal}
            onSuccess={handleSuccess}
          />
        )}
        {showMapModal && (
          <LocalesMapModal locales={locales} onClose={() => setShowMapModal(false)} />
        )}
      </AnimatePresence>
    </>
  )
}
