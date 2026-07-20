'use client'

import { motion } from 'framer-motion'
import { Rocket, MonitorSmartphone, BadgeCheck } from 'lucide-react'

export default function LandingHowItWorks() {
  const steps = [
    {
      icon: <Rocket className="w-8 h-8 text-blue-950" />,
      title: "1. Crea tu cuenta",
      desc: "Regístrate de forma segura, realiza tu pago de S/ 80 y accede al sistema al instante."
    },
    {
      icon: <MonitorSmartphone className="w-8 h-8 text-blue-950" />,
      title: "2. Sube tus productos",
      desc: "Importa tu catálogo fácilmente y configura tu tienda online con un par de clics."
    },
    {
      icon: <BadgeCheck className="w-8 h-8 text-blue-950" />,
      title: "3. Empieza a vender",
      desc: "Recibe pedidos por WhatsApp, factura y controla tu inventario desde el día uno."
    }
  ]

  return (
    <section className="py-24 bg-blue-500 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-extrabold text-blue-950 mb-6"
          >
            Implementación en tiempo récord
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-blue-900 max-w-2xl mx-auto font-medium"
          >
            Olvídate de las instalaciones complejas. Nuestro sistema está en la nube, listo para usarse.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.2 }}
              className="bg-white rounded-3xl p-8 shadow-xl shadow-blue-900/20 text-center hover:-translate-y-2 transition-transform duration-300"
            >
              <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                {step.icon}
              </div>
              <h3 className="text-2xl font-bold text-zinc-900 mb-4">{step.title}</h3>
              <p className="text-zinc-600 text-lg leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
