'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()

  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [aceptaTerminos, setAceptaTerminos] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (!aceptaTerminos) {
      setError('Debes aceptar los Términos y la Política de Privacidad para continuar.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()

      // Race: si Supabase tarda más de 1.5s enviando el email, redirigimos igual.
      // El usuario ya fue creado — el email llegará. Los errores rápidos (ej: email
      // duplicado) responden en < 500ms y se capturan normalmente.
      const result = await Promise.race([
        supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            // Pasa por /auth/confirm (ruta pública) que canjea el code por la
            // sesión y recién ahí manda a /onboarding. Redirigir directo a
            // /onboarding dejaba al usuario confirmado pero sin sesión.
            emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/auth/confirm?next=/onboarding`,
            // Deja constancia de cuándo aceptó los Términos — evidencia del
            // consentimiento si alguna vez hay una controversia.
            data: {
              terminos_aceptados_at: new Date().toISOString(),
              terminos_version: '2026-07',
            },
          },
        }),
        new Promise<{ data: null; error: null }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: null }), 1500)
        ),
      ])

      if (result.error) {
        if (result.error.message.includes('already registered')) {
          setError('Este correo ya tiene una cuenta. Inicia sesión.')
        } else {
          setError('Ocurrió un error al crear la cuenta. Inténtalo de nuevo.')
        }
        setLoading(false)
        return
      }

      router.push(`/auth/verify-email?email=${encodeURIComponent(form.email)}`)
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-8">
      <h2 className="text-xl font-semibold text-zinc-900 mb-1">Crear cuenta</h2>
      <p className="text-sm text-zinc-500 mb-6">Registra tu negocio en Uintegrus</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Correo electrónico
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="tu@correo.com"
            required
            className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Contraseña
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Mínimo 8 caracteres"
              required
              className="w-full px-3 py-2.5 pr-10 rounded-xl border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-transparent transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Confirmar contraseña
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            placeholder="Repite tu contraseña"
            required
            className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-transparent transition"
          />
        </div>

        {/* Aceptación expresa — hace exigibles los Términos (incl. contenido
            del usuario e indemnidad). Sin este consentimiento, esas cláusulas
            son mucho más difíciles de hacer valer. */}
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={aceptaTerminos}
            onChange={(e) => setAceptaTerminos(e.target.checked)}
            className="mt-0.5 w-4 h-4 shrink-0 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400 cursor-pointer"
          />
          <span className="text-xs text-zinc-600 leading-relaxed">
            He leído y acepto los{' '}
            <Link href="/legal/terminos" target="_blank" className="text-zinc-900 underline hover:text-zinc-700">
              Términos y Condiciones
            </Link>{' '}
            y la{' '}
            <Link href="/legal/privacidad" target="_blank" className="text-zinc-900 underline hover:text-zinc-700">
              Política de Privacidad
            </Link>
            . Declaro que tengo los derechos sobre el contenido que publique en la plataforma.
          </span>
        </label>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <div className="mt-4 text-center text-sm text-zinc-500">
        ¿Ya tienes cuenta?{' '}
        <Link href="/auth/login" className="text-zinc-900 hover:text-zinc-700 underline font-medium">
          Inicia sesión
        </Link>
      </div>
    </div>
  )
}
