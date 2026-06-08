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
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-zinc-100 bg-zinc-50">
        <div className="flex items-start gap-3">
          {icon && <div className="text-indigo-600 mt-0.5">{icon}</div>}
          <div className="flex-1">
            <h3 className="text-sm font-bold text-zinc-900">{title}</h3>
            {description && <p className="text-xs text-zinc-500 mt-1">{description}</p>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">{children}</div>

      {/* Footer - visible solo si hay acciones */}
      {(onSave || onCancel) && (
        <div className="border-t border-zinc-100 bg-zinc-50 px-6 py-3 flex items-center justify-end gap-3">
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
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
