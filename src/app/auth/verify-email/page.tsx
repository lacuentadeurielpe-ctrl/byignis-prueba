'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, CheckCircle, Loader2, RefreshCw } from 'lucide-react'
import Link from 'next/link'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  async function handleResend() {
    if (!email || resending || countdown > 0) return
    setResending(true)
    const supabase = createClient()
    await supabase.auth.resend({ type: 'signup', email })
    setResending(false)
    setResent(true)
    setCountdown(60)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-8 text-center">
      {/* Ícono animado */}
      <div className="mx-auto w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6">
        <Mail className="w-8 h-8 text-white" />
      </div>

      <h2 className="text-xl font-semibold text-zinc-900 mb-2">
        Revisa tu correo
      </h2>
      <p className="text-sm text-zinc-500 mb-1">
        Enviamos un enlace de confirmación a
      </p>
      {email && (
        <p className="text-sm font-medium text-zinc-900 mb-6 break-all">
          {email}
        </p>
      )}

      <div className="bg-zinc-50 rounded-xl p-4 text-left mb-6 space-y-2">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
          <p className="text-xs text-zinc-500">Abre el correo de <span className="font-medium text-zinc-700">Uintegrus</span></p>
        </div>
        <div className="flex items-start gap-3">
          <CheckCircle className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
          <p className="text-xs text-zinc-500">Haz clic en <span className="font-medium text-zinc-700">"Confirmar cuenta"</span></p>
        </div>
        <div className="flex items-start gap-3">
          <CheckCircle className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
          <p className="text-xs text-zinc-500">Serás redirigido a configurar tu negocio</p>
        </div>
      </div>

      {resent ? (
        <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 font-medium mb-4">
          <CheckCircle className="w-4 h-4" />
          Correo reenviado
          {countdown > 0 && <span className="text-zinc-400 font-normal">· reenviar en {countdown}s</span>}
        </div>
      ) : (
        <button
          onClick={handleResend}
          disabled={resending || countdown > 0}
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 disabled:opacity-40 mx-auto mb-4 transition"
        >
          {resending
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5" />}
          {countdown > 0 ? `Reenviar en ${countdown}s` : '¿No llegó? Reenviar correo'}
        </button>
      )}

      <p className="text-xs text-zinc-400">
        Revisa también tu carpeta de spam.{' '}
        <Link href="/auth/login" className="underline hover:text-zinc-600">
          Volver al inicio
        </Link>
      </p>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
