'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SuperadminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    // Limpiar cualquier sesión activa antes de iniciar como superadmin
    await supabase.auth.signOut()
    const { error: authError, data: signInData } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Credenciales incorrectas')
      setLoading(false)
      return
    }

    const accessToken = signInData?.session?.access_token
    if (!accessToken) {
      setError('No se pudo obtener la sesión')
      setLoading(false)
      return
    }

    // Verificar que es superadmin — pasamos el token explícitamente para evitar
    // dependencia de que las cookies lleguen al route handler en el mismo request
    const res = await fetch('/api/superadmin/auth-check', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      await supabase.auth.signOut()
      setError(body.error ?? 'Esta cuenta no tiene acceso al panel de superadmin')
      setLoading(false)
      return
    }

    router.push('/superadmin')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/uintegrus_logo_dark.png" alt="Uintegrus" className="mx-auto w-44 h-auto mb-2" />
          <p className="text-gray-400 text-sm mt-1">Panel de Superadmin</p>
        </div>

        <form onSubmit={handleLogin} className="bg-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-6">Iniciar sesión</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-950/40 border border-red-800 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="superadmin@uintegrus.com"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-900 font-semibold rounded-lg py-2.5 transition-colors"
            >
              {loading ? 'Verificando...' : 'Entrar al panel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
