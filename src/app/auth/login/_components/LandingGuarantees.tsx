'use client'

import { motion } from 'framer-motion'
import { ShieldCheck, MessageCircle, Zap } from 'lucide-react'

/**
 * Reemplaza los testimonios inventados (nombres y negocios ficticios) por
 * garantías reales del producto — mismo peso de conversión, cero riesgo de
 * publicidad engañosa. Ver [[feedback_landing_testimonios_falsos]].
 */
export default function LandingGuarantees() {
  const guarantees = [
    {
      icon: <ShieldCheck className="w-8 h-8 text-blue-400" />,
      title: 'Sin permanencia',
      desc: 'Pagas tu mes y lo usas. Si decides irte, simplemente dejas de pagar — sin penalidades ni letra pequeña.',
    },
    {
      icon: <MessageCircle className="w-8 h-8 text-blue-400" />,
      title: 'Soporte real por WhatsApp',
      desc: 'No te dejamos solo con un manual. Te acompañamos a configurar tu negocio y resolvemos tus dudas directo por WhatsApp.',
    },
    {
      icon: <Zap className="w-8 h-8 text-blue-400" />,
      title: 'Implementación el mismo día',
      desc: 'Te registras, pagas y accedes al instante. Sube tu catálogo y empieza a vender por WhatsApp hoy mismo.',
    },
  ]

  return (
    <section className="py-24 bg-zinc-900 border-t border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-extrabold text-white mb-6"
          >
            Sin riesgo para ti
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-zinc-400 max-w-2xl mx-auto"
          >
            Sabemos que confiar en un sistema nuevo da desconfianza. Por eso lo hacemos simple y sin ataduras.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {guarantees.map((g, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15 }}
              className="bg-zinc-950 rounded-3xl p-8 border border-white/5 hover:border-blue-500/30 transition-colors"
            >
              <div className="bg-blue-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                {g.icon}
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{g.title}</h3>
              <p className="text-zinc-400 text-lg leading-relaxed">{g.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
