'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Lock, LogOut, CheckCircle2 } from 'lucide-react'

export default function PaywallPage() {
  const router = useRouter()
  
  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleWhatsAppSupport = () => {
    const text = encodeURIComponent('Hola equipo de Uintegrus, acabo de crear mi cuenta y me gustaría activar el Plan Pro para mi negocio.')
    window.open(`https://wa.me/51980838850?text=${text}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Elementos de fondo */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none" />
      <div className="absolute -top-48 -right-48 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl">
          
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
            <Lock className="w-8 h-8 text-blue-400" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white text-center mb-3">
            Cuenta en Revisión
          </h1>
          <p className="text-zinc-400 text-center text-sm sm:text-base mb-8 leading-relaxed">
            ¡Felicidades por completar tu registro! Para mantener la calidad de nuestra plataforma, requerimos la activación de tu plan antes de acceder al panel de control.
          </p>

          <div className="space-y-4 mb-8 bg-black/30 rounded-2xl p-5 border border-white/5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-300">Ventas ilimitadas y control de inventario total.</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-300">Asistente de IA para responder a tus clientes 24/7.</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-300">Soporte técnico prioritario y actualizaciones.</p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleWhatsAppSupport}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              Contactar Soporte para Activar
            </button>
            <button
              onClick={handleLogout}
              className="w-full bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>
          
        </div>
      </div>
    </div>
  )
}
