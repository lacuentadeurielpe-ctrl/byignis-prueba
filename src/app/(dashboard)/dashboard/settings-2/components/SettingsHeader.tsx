'use client'

import { ChevronRight } from 'lucide-react'

interface SettingsHeaderProps {
  title: string
  description?: string
  breadcrumbs?: Array<{ label: string; href?: string }>
}

export default function SettingsHeader({ title, description, breadcrumbs }: SettingsHeaderProps) {
  return (
    <div className="border-b border-zinc-200 bg-gradient-to-r from-white via-zinc-50/50 to-white sticky top-0 z-40">
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-7xl mx-auto">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-4 overflow-x-auto whitespace-nowrap hide-scrollbar">
            {breadcrumbs.map((crumb, idx) => (
              <div key={idx} className="flex items-center gap-2 flex-shrink-0">
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />}
                <span className={idx === breadcrumbs.length - 1 ? 'text-zinc-700 font-semibold' : ''}>
                  {crumb.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Title & Description */}
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900">{title}</h1>
            {description && <p className="text-sm text-zinc-600 mt-1 md:mt-2">{description}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
