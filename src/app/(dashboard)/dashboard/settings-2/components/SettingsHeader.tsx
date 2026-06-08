'use client'

import { ChevronRight } from 'lucide-react'

interface SettingsHeaderProps {
  title: string
  description?: string
  breadcrumbs?: Array<{ label: string; href?: string }>
}

export default function SettingsHeader({ title, description, breadcrumbs }: SettingsHeaderProps) {
  return (
    <div className="border-b border-zinc-200 bg-white sticky top-0 z-40">
      <div className="px-6 py-4">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-3">
            {breadcrumbs.map((crumb, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {idx > 0 && <ChevronRight className="w-4 h-4" />}
                <span>{crumb.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
          {description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}
        </div>
      </div>
    </div>
  )
}
