'use client'

import { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface FormSectionProps {
  title: string
  description?: string
  icon?: ReactNode
  children: ReactNode
  onSave?: () => Promise<void> | void
  onCancel?: () => void
  isSaving?: boolean
  isDirty?: boolean
}

export default function FormSection({
  title,
  description,
  icon,
  children,
  onSave,
  onCancel,
  isSaving = false,
  isDirty = false,
}: FormSectionProps) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden hover:shadow-md transition">
      {/* Header */}
      <div className="p-6 border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-white">
        <div className="flex items-start gap-4">
          {icon && (
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-zinc-900">{title}</h3>
            {description && <p className="text-xs text-zinc-500 mt-2">{description}</p>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-5">{children}</div>

      {/* Footer - visible solo si hay acciones */}
      {(onSave || onCancel) && (
        <div className={`border-t border-zinc-100 px-6 py-4 flex items-center justify-end gap-3 transition ${isDirty ? 'bg-indigo-50/30' : 'bg-zinc-50/50'}`}>
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
          {onSave && (
            <button
              onClick={onSave}
              disabled={isSaving || !isDirty}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? 'Guardando...' : isDirty ? 'Guardar cambios' : 'Sin cambios'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
