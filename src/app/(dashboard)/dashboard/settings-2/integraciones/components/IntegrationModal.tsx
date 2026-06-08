'use client'

import { X } from 'lucide-react'
import { ReactNode } from 'react'

interface IntegrationModalProps {
  title: string
  description?: string
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export default function IntegrationModal({
  title,
  description,
  isOpen,
  onClose,
  children,
  size = 'md',
}: IntegrationModalProps) {
  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg shadow-lg w-full ${sizeClasses[size]}`}>
        <div className="flex items-center justify-between p-6 border-b border-zinc-200">
          <div>
            <h2 className="font-semibold text-zinc-900">{title}</h2>
            {description && <p className="text-sm text-zinc-600 mt-1">{description}</p>}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
