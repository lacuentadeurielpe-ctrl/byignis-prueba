'use client'

import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import LocalesMapView from './LocalesMapView'
import type { Local } from '@/types/locales'

interface LocalesMapModalProps {
  locales: Local[]
  onClose: () => void
}

export default function LocalesMapModal({ locales, onClose }: LocalesMapModalProps) {
  const activeCount = locales.filter(l => l.activo).length
  const principal = locales.find(l => l.es_principal)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-200">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">📍 Mapa de locales</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {activeCount} local{activeCount !== 1 ? 'es' : ''} activo{activeCount !== 1 ? 's' : ''} ·
              {principal ? ` Principal: ${principal.nombre}` : ' Sin principal'}
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
        <div className="p-6">
          <LocalesMapView locales={locales} zoom={11} />
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-zinc-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Cerrar mapa
          </button>
        </div>
      </motion.div>
    </div>
  )
}
