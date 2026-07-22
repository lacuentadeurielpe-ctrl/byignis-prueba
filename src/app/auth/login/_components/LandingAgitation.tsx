'use client'

import { motion } from 'framer-motion'
import { AlertCircle, TrendingDown, Clock } from 'lucide-react'

export default function LandingAgitation() {
  const problems = [
    {
      icon: <TrendingDown className="w-8 h-8 text-rose-500" />,
      title: "Ventas que se escapan",
      desc: "Un cliente pregunta por WhatsApp y le respondes horas después. O dices 'creo que sí tengo' y terminas perdiendo la venta."
    },
    {
      icon: <Clock className="w-8 h-8 text-rose-500" />,
      title: "Horas perdidas en papeleo",
      desc: "Hacer boletas y facturas a mano, cuadrar la caja, pasar todo a Excel. Tiempo que deberías dedicar a vender o a tu familia."
    },
    {
      icon: <AlertCircle className="w-8 h-8 text-rose-500" />,
      title: "No sabes qué pasa cuando no estás",
      desc: "Cuánto se vendió hoy, quién atendió, cuánto quedó en caja. Si no estás presente, trabajas a ciegas."
    }
  ]

  return (
    <section className="py-24 bg-zinc-950 relative overflow-hidden border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-extrabold text-white mb-6"
          >
            Seamos honestos... <span className="text-rose-500">Administrar a ciegas te está costando dinero.</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-zinc-400 max-w-2xl mx-auto"
          >
            Llevar el control de tu negocio en cuadernos, Excel o sistemas antiguos y complicados solo genera estrés y pérdidas ocultas.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {problems.map((problem, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.2 }}
              className="bg-rose-500/5 border border-rose-500/10 rounded-3xl p-8 hover:bg-rose-500/10 transition-colors"
            >
              <div className="bg-rose-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                {problem.icon}
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">{problem.title}</h3>
              <p className="text-zinc-400 text-lg leading-relaxed">{problem.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
