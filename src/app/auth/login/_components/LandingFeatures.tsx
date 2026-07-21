'use client'

import { motion } from 'framer-motion'
import { ShoppingCart, Receipt, Package, Building2, Users, FileText } from 'lucide-react'
import {
  MockupTienda,
  MockupFacturacion,
  MockupInventario,
  MockupSucursales,
  MockupEquipo,
  MockupCotizaciones,
} from './ProductMockups'

export default function LandingFeatures() {
  const features = [
    {
      title: "Tienda Online Integrada",
      desc: "Comparte tu catálogo con un link. Tus clientes arman su pedido y te lo envían directo a WhatsApp con un clic.",
      icon: <ShoppingCart className="w-6 h-6 text-blue-400" />,
      mockup: <MockupTienda />,
    },
    {
      title: "Facturación Electrónica",
      desc: "Genera boletas y facturas válidas para SUNAT en segundos, sin errores ni procesos tediosos.",
      icon: <Receipt className="w-6 h-6 text-blue-400" />,
      mockup: <MockupFacturacion />,
    },
    {
      title: "Gestión de Inventarios",
      desc: "Control exacto y en tiempo real de tu stock. Nunca más pierdas una venta por no saber qué tienes.",
      icon: <Package className="w-6 h-6 text-blue-400" />,
      mockup: <MockupInventario />,
    },
    {
      title: "Múltiples Sucursales",
      desc: "Supervisa todo tu negocio y los movimientos de cada local desde tu celular en una sola pantalla.",
      icon: <Building2 className="w-6 h-6 text-blue-400" />,
      mockup: <MockupSucursales />,
    },
    {
      title: "Clientes y Empleados",
      desc: "Asigna permisos a tu equipo, controla quién vende qué, y mantén un historial completo de tus clientes.",
      icon: <Users className="w-6 h-6 text-blue-400" />,
      mockup: <MockupEquipo />,
    },
    {
      title: "Cotizaciones Profesionales",
      desc: "Cierra ventas al instante enviando cotizaciones con formato premium directo al cliente en PDF.",
      icon: <FileText className="w-6 h-6 text-blue-400" />,
      mockup: <MockupCotizaciones />,
    }
  ]

  return (
    <section className="py-32 bg-zinc-950 border-t border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-20">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-extrabold text-white mb-6"
          >
            Todo lo que tu negocio necesita
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-zinc-400 max-w-2xl mx-auto"
          >
            La solución definitiva para reemplazar el desorden por control absoluto y ventas aceleradas.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: idx * 0.1 }}
              className="bg-zinc-900/40 rounded-3xl border border-white/5 overflow-hidden hover:border-blue-500/50 transition-all duration-300 group hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
            >
              <div className="h-56 relative overflow-hidden bg-zinc-900 p-4">
                <div className="w-full h-full transition-transform duration-700 ease-in-out group-hover:scale-[1.03]">
                  {feature.mockup}
                </div>
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none"></div>
                <div className="absolute bottom-6 left-6 w-14 h-14 bg-zinc-950/80 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 shadow-xl group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-zinc-400 text-base leading-relaxed">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
