'use client'

import { AlertTriangle, ShieldAlert } from 'lucide-react'

interface Props {
  certVenceAt: string | null   // ISO date string, e.g. "2025-10-31"
}

export default function CertificadoBanner({ certVenceAt }: Props) {
  if (!certVenceAt) return null

  const vence   = new Date(certVenceAt)
  const ahora   = new Date()
  const diasRestantes = Math.ceil((vence.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24))

  if (diasRestantes > 30) return null  // todo bien, no mostrar nada

  const expirado = diasRestantes <= 0
  const urgente  = diasRestantes <= 7

  const texto = expirado
    ? `Tu certificado digital SUNAT venció el ${vence.toLocaleDateString('es-PE')}. La emisión electrónica está bloqueada.`
    : `Tu certificado digital SUNAT vence en ${diasRestantes} día(s) (${vence.toLocaleDateString('es-PE')}). Renuévalo antes de que expire.`

  const accion = 'Ir a Configuración → Integraciones → SUNAT Directo para subir el nuevo certificado.'

  return (
    <div className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm border mb-4 ${
      expirado || urgente
        ? 'bg-red-50 border-red-200 text-red-700'
        : 'bg-amber-50 border-amber-200 text-amber-700'
    }`}>
      {expirado || urgente
        ? <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
        : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
      }
      <div>
        <p className="font-bold">{texto}</p>
        <p className="text-xs mt-0.5 opacity-80">{accion}</p>
      </div>
    </div>
  )
}
