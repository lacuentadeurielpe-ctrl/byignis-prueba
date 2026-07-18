'use client'

import { useState, useEffect } from 'react'
import { ArrowRight, CheckCircle2, Play } from 'lucide-react'
import { motion } from 'framer-motion'

export default function LandingHero() {
  const [showButtons, setShowButtons] = useState(false)
  
  useEffect(() => {
    // 1. Mostrar botones tras 5 segundos (simulando 3 seg antes del fin de un video de 8 seg, etc)
    const timer = setTimeout(() => {
      setShowButtons(true)
    }, 5000)

    // 2. Mostrar botones si el usuario hace scroll hacia abajo (atrapa la intención de seguir leyendo)
    const handleScroll = () => {
      // Ajustamos el scroll trigger a 100px para que sea más responsivo en móvil
      if (window.scrollY > 100) {
        setShowButtons(true)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  }

  // Componente extraído para el Video, así lo podemos renderizar en distintos lugares según la pantalla (móvil vs PC)
  const VideoPlayer = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.4 }}
      className="relative mx-auto w-full max-w-[320px] md:max-w-[420px] aspect-[3/4] rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-zinc-900 border border-zinc-800 shadow-[0_0_40px_rgba(0,0,0,0.6)] group"
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className="absolute inset-0"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent z-10"></div>
        
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 overflow-hidden">
           <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
           
           {/* Ripple Effect Animation */}
           <div className="absolute w-32 h-32 bg-blue-500/10 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>

           <div className="relative z-20 w-20 h-20 md:w-24 md:h-24 bg-blue-500/20 backdrop-blur-md rounded-full flex items-center justify-center border border-blue-500/50 group-hover:scale-110 group-hover:bg-blue-500/30 transition-all cursor-pointer shadow-[0_0_30px_rgba(59,130,246,0.3)]">
              <Play className="w-8 h-8 md:w-10 md:h-10 text-blue-400 ml-1 md:ml-2" />
           </div>
        </div>

        <div className="absolute bottom-6 md:bottom-8 left-4 md:left-8 right-4 md:right-8 z-20 text-center">
          <span className="inline-block px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white font-medium text-xs md:text-sm mb-2 md:mb-3">
            1:00 MINUTO
          </span>
          <p className="text-white font-bold text-lg md:text-xl drop-shadow-lg leading-tight">Mira cómo funciona por dentro</p>
        </div>
      </motion.div>
    </motion.div>
  );

  // Componente extraído para los Botones (CTAs)
  const CallToActions = () => (
    <div className={`transition-all duration-700 transform ${showButtons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
      <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
        <a 
          href="#pricing"
          className="w-full sm:w-auto flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-[0_0_30px_rgba(59,130,246,0.2)] hover:shadow-[0_0_50px_rgba(59,130,246,0.4)] hover:-translate-y-1 text-lg"
        >
          Compra Directa - S/ 85
          <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
        </a>
        <a 
          href="#"
          className="w-full sm:w-auto flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all border border-zinc-800 hover:border-zinc-700 hover:-translate-y-1 text-lg"
        >
          <svg className="w-5 h-5 md:w-6 md:h-6 fill-[#25D366]" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824zm-3.423-14.416c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm.029 18.88c-1.161 0-2.305-.292-3.318-.844l-3.677.964.984-3.595c-.607-1.052-.927-2.246-.926-3.468.001-3.825 3.113-6.937 6.937-6.937 3.825 0 6.938 3.112 6.938 6.937 0 3.825-3.113 6.938-6.938 6.937z"/></svg>
          Consultas
        </a>
      </div>
    </div>
  );

  return (
    <section className="pt-28 md:pt-36 pb-16 md:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative overflow-hidden text-center lg:text-left">
      {/* Background blurs */}
      <div className="absolute top-0 md:top-1/4 left-1/2 md:left-0 -translate-x-1/2 md:translate-x-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-blue-500/20 rounded-full blur-[80px] md:blur-[120px] -z-10 opacity-50"></div>
      <div className="absolute bottom-0 right-1/2 md:right-0 translate-x-1/2 md:translate-x-0 w-[250px] md:w-[400px] h-[250px] md:h-[400px] bg-cyan-500/10 rounded-full blur-[80px] md:blur-[100px] -z-10 opacity-50"></div>

      {/* Estructura Mobile vs Desktop */}
      <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
        
        {/* Columna Izquierda (en PC) / Arriba (en Móvil) */}
        <motion.div 
          className="w-full lg:w-1/2 flex flex-col space-y-8 md:space-y-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* HEADER TITLES */}
          <div className="space-y-6 md:space-y-8">
            <motion.div variants={itemVariants} className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs md:text-sm font-semibold tracking-wide mx-auto lg:mx-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
              El Sistema Definitivo para PYMES
            </motion.div>
            
            <motion.h1 variants={itemVariants} className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight text-white leading-[1.1] md:leading-[1.1]">
              Toma el Control <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 drop-shadow-sm block sm:inline">Total de tu Negocio</span> sin Complicaciones.
            </motion.h1>
            
            <motion.p variants={itemVariants} className="text-lg md:text-xl text-zinc-400 leading-relaxed max-w-lg mx-auto lg:mx-0">
              El único software que necesitas para vender, facturar, controlar inventario y sucursales a un precio ridículamente accesible.
            </motion.p>
          </div>

          {/* VIDEO PARA MÓVIL (Se inserta justo después del título en móviles, pero se oculta en PC) */}
          <div className="block lg:hidden w-full py-4">
            <VideoPlayer />
          </div>

          {/* CHECKMARKS */}
          <motion.div variants={itemVariants} className="space-y-3 md:space-y-4 text-left inline-block lg:w-full mx-auto lg:mx-0 max-w-sm lg:max-w-none">
            <div className="flex items-center gap-3 md:gap-4 text-zinc-300">
              <div className="bg-blue-500/10 p-1 rounded-full shrink-0"><CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-blue-400" /></div>
              <span className="text-base md:text-lg">Implementación inmediata hoy mismo</span>
            </div>
            <div className="flex items-center gap-3 md:gap-4 text-zinc-300">
              <div className="bg-blue-500/10 p-1 rounded-full shrink-0"><CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-blue-400" /></div>
              <span className="text-base md:text-lg">Fácil de usar, sin conocimientos técnicos</span>
            </div>
            <div className="flex items-center gap-3 md:gap-4 text-zinc-300">
              <div className="bg-blue-500/10 p-1 rounded-full shrink-0"><CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-blue-400" /></div>
              <span className="text-base md:text-lg">Sin pagos ocultos ni sorpresas</span>
            </div>
          </motion.div>

          {/* CTAs */}
          <div className="pt-2">
            <CallToActions />
          </div>

        </motion.div>

        {/* Columna Derecha (en PC) - VIDEO PARA PC (Oculto en móvil) */}
        <div className="hidden lg:block w-full lg:w-1/2">
          <VideoPlayer />
        </div>

      </div>
    </section>
  )
}
