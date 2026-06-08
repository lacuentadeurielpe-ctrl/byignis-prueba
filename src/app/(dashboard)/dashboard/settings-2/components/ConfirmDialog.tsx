'use client'

import { AlertTriangle, Loader2 } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  isDangerous?: boolean
  isLoading?: boolean
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDangerous = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className={`p-5 flex items-center gap-3 ${isDangerous ? 'bg-rose-50' : 'bg-blue-50'}`}>
          <AlertTriangle className={isDangerous ? 'w-5 h-5 text-rose-600' : 'w-5 h-5 text-blue-600'} />
          <h2 className={`font-bold text-sm ${isDangerous ? 'text-rose-900' : 'text-blue-900'}`}>{title}</h2>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-zinc-600">{description}</p>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 px-6 py-3 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition text-white ${
              isDangerous
                ? 'bg-rose-600 hover:bg-rose-700 disabled:opacity-50'
                : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50'
            }`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
