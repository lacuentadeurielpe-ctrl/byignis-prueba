'use client'

import { Suspense } from 'react'
import { Lock, Loader2 } from 'lucide-react'
import LandingHero from './_components/LandingHero'
import LandingAgitation from './_components/LandingAgitation'
import LandingFeatures from './_components/LandingFeatures'
import LandingHowItWorks from './_components/LandingHowItWorks'
import LandingTestimonials from './_components/LandingTestimonials'
import LandingPricing from './_components/LandingPricing'
import LandingFAQ from './_components/LandingFAQ'
import LoginForm from './_components/LoginForm'
import LandingFooter from './_components/LandingFooter'

export default function LoginPage() {
  const scrollToLogin = () => {
    document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-blue-500/30">
      {/* Navbar Minimalista */}
      <nav className="fixed top-0 w-full z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/uintegrus_favicon.png" alt="Uintegrus Logo" className="h-8 w-auto" />
            <span className="font-bold text-2xl tracking-tight hidden sm:block">Uintegrus</span>
          </div>
          <button 
            onClick={scrollToLogin}
            className="text-sm font-medium text-zinc-300 hover:text-white transition-all px-5 py-2.5 rounded-xl hover:bg-white/10 flex items-center gap-2 border border-transparent hover:border-white/10"
          >
            <Lock className="w-4 h-4" />
            Ya tengo cuenta
          </button>
        </div>
      </nav>

      {/* Embudo de Ventas Modular */}
      <LandingHero />
      <LandingAgitation />
      <LandingHowItWorks />
      <LandingFeatures />
      <LandingTestimonials />
      <LandingPricing />
      <LandingFAQ />

      {/* Sección de Login para Clientes Actuales */}
      <section className="py-32 relative bg-zinc-900/30 border-t border-white/5">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80')] opacity-5 bg-cover bg-center"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-white mb-4">¿Ya eres parte de Uintegrus?</h2>
            <p className="text-lg text-zinc-400">Accede a tu panel y sigue controlando tu negocio.</p>
          </div>
          
          <Suspense fallback={
            <div className="w-full max-w-md mx-auto bg-zinc-900/80 rounded-3xl border border-white/10 p-12 flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            </div>
          }>
            <LoginForm />
          </Suspense>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}
