import Link from 'next/link'

export default function LandingFooter() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-zinc-950 border-t border-white/10 pt-16 pb-8 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
               <img src="/uintegrus_favicon.png" alt="Uintegrus Logo" className="w-8 h-8 rounded" />
               <span className="text-xl font-bold text-white tracking-tight">Uintegrus</span>
            </div>
            <p className="text-zinc-400 text-sm max-w-sm leading-relaxed">
              El sistema definitivo para PYMES. Facturación electrónica, ventas por WhatsApp, control de inventarios y gestión de sucursales en un solo lugar.
            </p>
          </div>

          {/* Legal Links */}
          <div className="col-span-1">
            <h4 className="text-white font-semibold mb-4">Legales</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/legal/terminos" className="text-zinc-400 hover:text-blue-400 text-sm transition-colors">
                  Términos y Condiciones
                </Link>
              </li>
              <li>
                <Link href="/legal/privacidad" className="text-zinc-400 hover:text-blue-400 text-sm transition-colors">
                  Políticas de Privacidad
                </Link>
              </li>
              <li>
                <Link href="/legal/reembolso" className="text-zinc-400 hover:text-blue-400 text-sm transition-colors">
                  Políticas de Reembolso
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="col-span-1">
            <h4 className="text-white font-semibold mb-4">Contacto y Empresa</h4>
            <ul className="space-y-3">
              <li className="text-zinc-400 text-sm">
                Lima, Perú
              </li>
              <li>
                <a href="mailto:soporte@uintegrus.com" className="text-zinc-400 hover:text-blue-400 text-sm transition-colors">
                  soporte@uintegrus.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-zinc-500 text-sm">
            © {currentYear} Uintegrus. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
