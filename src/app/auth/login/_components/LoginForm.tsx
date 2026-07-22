'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react'

// Mensajes para los errores que /auth/confirm anexa a la URL
const ERRORES_URL: Record<string, string> = {
  link_expirado: 'El enlace de confirmación venció o ya fue usado. Inicia sesión — si tu correo aún no está confirmado, te reenviaremos el enlace.',
  link_invalido: 'El enlace de confirmación no es válido. Inicia sesión o solicita uno nuevo.',
}

// Avisos positivos (no son errores)
const INFOS_URL: Record<string, string> = {
  correo_confirmado: '¡Tu correo fue confirmado! Ingresa con tu contraseña para continuar.',
}

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/dashboard'
  const errorUrl = searchParams.get('error')
  const infoUrl = searchParams.get('info')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    errorUrl ? (ERRORES_URL[errorUrl] ?? null) : null
  )
  const info = infoUrl ? (INFOS_URL[infoUrl] ?? null) : null

  // El form vive al fondo de la landing: si /auth/confirm redirigió con un
  // error o aviso, bajar hasta él para que el mensaje sea visible.
  // window.scrollTo con posición calculada — scrollIntoView se cancela por el
  // scroll-behavior global + los layout shifts de video/animaciones. Doble
  // intento: uno temprano y otro cuando el contenido pesado asentó la altura.
  useEffect(() => {
    if (!errorUrl && !infoUrl) return
    const bajar = () => {
      const el = document.getElementById('login-section')
      if (!el) return
      const y = el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2 + el.offsetHeight / 2
      window.scrollTo(0, Math.max(0, y))
    }
    const t1 = setTimeout(bajar, 300)
    const t2 = setTimeout(bajar, 1500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [errorUrl, infoUrl])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      // Cuenta creada pero correo sin confirmar → llevarlo al reenvío,
      // no mentirle con "contraseña incorrecta".
      if (/email not confirmed/i.test(error.message)) {
        router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`)
        return
      }
      setError('Correo o contraseña incorrectos. Intente de nuevo.')
      setLoading(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 w-full max-w-md mx-auto" id="login-section">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
          <Lock className="w-5 h-5 text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Acceso Clientes</h2>
      </div>
      <p className="text-sm text-zinc-400 mb-8 pl-13">Ingresa a tu panel de gestión y continúa donde te quedaste.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Correo electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            required
            className="w-full px-4 py-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Contraseña
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3.5 pr-12 rounded-xl bg-zinc-900/50 border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {info && !error && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3.5 text-sm text-emerald-400 flex items-start gap-2">
            <span className="shrink-0 mt-0.5">✓</span>
            <span>{info}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3.5 text-sm text-red-400 flex items-start gap-2">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-60 text-zinc-950 font-bold py-3.5 rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 mt-2"
        >
          {loading && <Loader2 className="w-5 h-5 animate-spin" />}
          {loading ? 'Ingresando...' : 'Ingresar al Sistema'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between text-sm">
        <Link href="/auth/reset-password" className="text-zinc-400 hover:text-white transition">
          ¿Olvidaste tu contraseña?
        </Link>
        <Link href="/auth/register" className="text-blue-400 hover:text-blue-300 font-medium transition">
          Crear cuenta
        </Link>
      </div>
    </div>
  )
}
