'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    question: "¿Necesito conocimientos técnicos para usarlo?",
    answer: "No, para nada. El sistema está diseñado específicamente para dueños de negocios, no para informáticos. Es tan fácil de usar como WhatsApp."
  },
  {
    question: "¿Hay algún contrato de permanencia?",
    answer: "Cero contratos. Pagas tu mes y lo usas. Si no te gusta (que lo dudamos), simplemente dejas de pagar y listo, sin penalidades."
  },
  {
    question: "¿Funciona en celular?",
    answer: "Sí, puedes acceder desde tu celular, tablet o computadora. Mientras tengas internet, tienes el control de tu negocio en la palma de tu mano."
  },
  {
    question: "¿Qué pasa si tengo dudas al usarlo?",
    answer: "Tendrás acceso a nuestro soporte técnico por WhatsApp. Te ayudaremos con cualquier duda que tengas para que le saques el máximo provecho."
  }
]

export default function LandingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="py-24 bg-zinc-950 border-t border-white/5 relative">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-extrabold text-white mb-6"
          >
            Preguntas Frecuentes
          </motion.h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
              >
                <span className="text-lg font-bold text-white">{faq.question}</span>
                <ChevronDown 
                  className={`w-5 h-5 text-blue-500 transition-transform duration-300 ${openIndex === idx ? 'rotate-180' : ''}`} 
                />
              </button>
              
              <AnimatePresence>
                {openIndex === idx && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="px-6 pb-5 text-zinc-400">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
