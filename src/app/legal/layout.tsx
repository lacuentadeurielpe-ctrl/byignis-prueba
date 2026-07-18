import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import LandingFooter from '../auth/login/_components/LandingFooter'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-blue-500/30 flex flex-col">
      <nav className="sticky top-0 w-full z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/auth/login" className="text-zinc-400 hover:text-white flex items-center gap-2 transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
          <div className="flex items-center gap-2">
            <img src="/uintegrus_favicon.png" alt="Uintegrus Logo" className="h-6 w-auto" />
            <span className="font-bold text-lg tracking-tight hidden sm:block text-white">Uintegrus</span>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        {children}
      </main>

      <LandingFooter />
    </div>
  )
}
