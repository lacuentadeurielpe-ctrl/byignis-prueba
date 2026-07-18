'use client'

import { motion } from 'framer-motion'
import { Star } from 'lucide-react'

export default function LandingTestimonials() {
  const testimonials = [
    {
      name: "Carlos Mendoza",
      business: "Ferretería El Constructor",
      text: "Antes perdía horas haciendo boletas y buscando si me quedaba stock. Desde que uso Uintegrus, todo está en mi celular. Vale cada centavo de los 85 soles."
    },
    {
      name: "Ana Lucía Reyes",
      business: "Boutique Bella",
      text: "El catálogo online es una maravilla. Se lo paso a mis clientas por WhatsApp, ellas mismas eligen su talla y me mandan el pedido listo. Me ha simplificado la vida."
    },
    {
      name: "Jorge Ramírez",
      business: "Minimarket Los Pinos",
      text: "Tengo dos locales y antes me volvía loco para cuadrarlos. Ahora veo las ventas de ambas sucursales en vivo. Muy fácil de usar."
    }
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
            Únete a cientos de dueños de negocios
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-zinc-400 max-w-2xl mx-auto"
          >
            No tomes nuestra palabra, escucha lo que dicen los emprendedores que ya transformaron su gestión.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((test, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.2 }}
              className="bg-zinc-950 rounded-3xl p-8 border border-white/5 hover:border-blue-500/30 transition-colors"
            >
              <div className="flex items-center gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-blue-500 text-blue-500" />
                ))}
              </div>
              <p className="text-zinc-300 text-lg italic mb-6">"{test.text}"</p>
              <div>
                <h4 className="text-white font-bold">{test.name}</h4>
                <span className="text-blue-400 text-sm">{test.business}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
