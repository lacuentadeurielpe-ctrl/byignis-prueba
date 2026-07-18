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
            <a
              href="/#pricing"
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:-translate-y-0.5"
            >
              Compra Directa - S/ 85
            </a>
            
            <button
              onClick={handleWhatsAppSupport}
              className="w-full bg-[#40543B] hover:bg-[#4C6446] text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:-translate-y-0.5 border border-[#5A7553]/50"
            >
              <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824zm-3.423-14.416c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm.029 18.88c-1.161 0-2.305-.292-3.318-.844l-3.677.964.984-3.595c-.607-1.052-.927-2.246-.926-3.468.001-3.825 3.113-6.937 6.937-6.937 3.825 0 6.938 3.112 6.938 6.937 0 3.825-3.113 6.938-6.938 6.937z"/></svg>
              Chatea con un asesor
            </button>
            
            <button
              onClick={() => {
                router.refresh()
                window.location.reload()
              }}
              className="w-full bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
            >
              Ya realicé el pago, actualizar
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
