'use client'

import { motion } from 'framer-motion'
import { Check, ArrowRight } from 'lucide-react'

export default function LandingPricing() {
  const benefits = [
    "Facturación electrónica ilimitada (SUNAT)",
    "Tienda online para pedidos por WhatsApp",
    "Gestión de inventario en tiempo real",
    "Control de múltiples sucursales",
    "Perfiles para cajeros y administradores",
    "Soporte técnico y actualizaciones incluidas",
    "Sin costo de instalación ni contratos amarrados"
  ]

  return (
    <section id="pricing" className="py-24 bg-zinc-950 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-extrabold text-white mb-6"
          >
            Una inversión ridícula para el valor que obtienes
          </motion.h2>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-zinc-900/80 backdrop-blur-xl border border-blue-500/30 rounded-[2.5rem] p-8 md:p-12 shadow-[0_0_50px_rgba(16,185,129,0.15)] max-w-2xl mx-auto relative overflow-hidden"
        >
          {/* Badge */}
          <div className="absolute top-0 right-0 bg-blue-500 text-zinc-950 text-sm font-bold px-4 py-1.5 rounded-bl-2xl">
            OFERTA ÚNICA
          </div>

          <div className="text-center mb-8 border-b border-white/10 pb-8">
            <h3 className="text-2xl text-zinc-400 font-medium mb-2">Plan Todo Incluido</h3>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-3xl font-bold text-zinc-500 line-through">S/ 120</span>
              <span className="text-6xl font-extrabold text-white">S/ 80</span>
            </div>
            <p className="text-blue-400 font-medium mt-2">Pago fijo mensual sin comisiones ocultas</p>
          </div>

          <div className="space-y-4 mb-10">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="bg-blue-500/10 p-1 rounded-full shrink-0">
                  <Check className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-zinc-300">{benefit}</span>
              </div>
            ))}
          </div>

          <a
            href="/auth/register"
            className="w-full bg-blue-500 hover:bg-blue-400 text-zinc-950 font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.5)] text-lg"
          >
            Empezar prueba gratis de 3 días
            <ArrowRight className="w-6 h-6" />
          </a>
          <p className="text-center text-zinc-500 text-sm mt-4">Sin tarjeta para probar. Luego S/ 80/mes con Mercado Pago.</p>
        </motion.div>
      </div>
    </section>
  )
}
