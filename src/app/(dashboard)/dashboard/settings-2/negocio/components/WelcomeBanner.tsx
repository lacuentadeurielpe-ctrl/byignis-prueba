'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Sparkles } from 'lucide-react'

function Banner() {
  const params = useSearchParams()
  if (!params.get('welcome')) return null

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl flex items-start gap-3">
      <div className="p-1.5 bg-orange-100 rounded-lg flex-shrink-0">
        <Sparkles className="w-4 h-4 text-orange-600" />
      </div>
      <div>
        <p className="text-sm font-semibold text-orange-900">¡Bienvenido a Uintegrus!</p>
        <p className="text-xs text-orange-700 mt-0.5">
          Completa los datos de tu negocio aquí. Todo lo que configures se reflejará automáticamente en el bot y el panel.
        </p>
      </div>
    </div>
  )
}

export default function WelcomeBanner() {
  return (
    <Suspense>
      <Banner />
    </Suspense>
  )
}
