'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SaasRepository } from '@/lib/db/repositories/saas'
import { Loader2 } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Si el usuario ya tiene negocio, mandarlo al dashboard
  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth/login'); return }
      const repo = new SaasRepository(supabase)
      const ferreteria = await repo.obtenerFerreteriaPorDuenio(user.id)
      if (ferreteria) {
        router.replace('/dashboard')
      } else {
        setChecking(false)
      }
    }
    check()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nombre.trim()) { setError('El nombre del negocio es obligatorio.'); return }
    if (!telefono.trim()) { setError('El número de WhatsApp es obligatorio.'); return }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const repo = new SaasRepository(supabase)
    try {
      await repo.crearFerreteria({
        owner_id: user.id,
        nombre: nombre.trim(),
        telefono_whatsapp: telefono.trim(),
        direccion: null,
        horario_apertura: '08:00',
        horario_cierre: '18:00',
        dias_atencion: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
        formas_pago: [],
        mensaje_bienvenida: null,
        mensaje_fuera_horario: null,
        onboarding_completo: true,
        tipo_ruc: 'sin_ruc',
        ruc: null,
        razon_social: null,
        regimen_tributario: null,
        representante_legal_nombre: null,
        representante_legal_dni: null,
      })
      router.push('/dashboard/settings-2/negocio?welcome=1')
    } catch (err: any) {
      if (err.message?.includes('telefono_whatsapp')) {
        setError('Ese número de WhatsApp ya está registrado.')
      } else {
        setError('Error al guardar. Inténtalo de nuevo.')
      }
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Configura tu negocio</h1>
          <p className="text-sm text-gray-500 mt-2">
            Solo necesitamos dos datos para comenzar. El resto lo configuras en el panel.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre del negocio <span className="text-red-500">*</span>
              </label>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Don Mario Suministros"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Número de WhatsApp <span className="text-red-500">*</span>
              </label>
              <input
                value={telefono}
                onChange={e => setTelefono(e.target.value.replace(/\D/g, ''))}
                placeholder="51987654321 (con código de país)"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
              />
              <p className="text-xs text-gray-400 mt-1">Debe coincidir con el número en YCloud</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-medium rounded-lg text-sm transition"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Creando tu negocio...' : 'Continuar a configuración →'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Podrás configurar RUC, horarios, zonas de delivery y más desde el panel.
        </p>
      </div>
    </div>
  )
}
