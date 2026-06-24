'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, CheckCircle, Loader2, RefreshCw } from 'lucide-react'
import Link from 'next/link'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [confirmed, setConfirmed] = useState(false)

  // Countdown para reenvío
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // Detectar confirmación automática (mismo navegador o polling cross-device)
  useEffect(() => {
    const supabase = createClient()

    // 1. onAuthStateChange: detecta si el mismo navegador confirma en otra pestaña
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        setConfirmed(true)
        setTimeout(() => router.push('/onboarding'), 1500)
      }
    })

    // 2. Polling cada 4s: detecta confirmación desde otro dispositivo (celular)
    const poll = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        clearInterval(poll)
        setConfirmed(true)
        setTimeout(() => router.push('/onboarding'), 1500)
      }
    }, 4000)

    return () => {
      subscription.unsubscribe()
      clearInterval(poll)
    }
  }, [router])

  async function handleResend() {
    if (!email || resending || countdown > 0) return
    setResending(true)
    const supabase = createClient()
    await supabase.auth.resend({ type: 'signup', email })
    setResending(false)
    setResent(true)
    setCountdown(60)
  }

  if (confirmed) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mb-6">
          <CheckCircle className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">¡Correo confirmado!</h2>
        <p className="text-sm text-zinc-500">Redirigiendo a tu panel...</p>
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400 mx-auto mt-4" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-8 text-center">
      {/* Ícono */}
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
          <p className="text-xs text-zinc-500">Esta página se actualizará automáticamente</p>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-center text-xs text-zinc-400 mb-5">
        <Loader2 className="w-3 h-3 animate-spin" />
        Esperando confirmación...
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-xl font-bold text-zinc-900">Uintegrus</span>
        </div>
        <Suspense fallback={
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        }>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  )
}
