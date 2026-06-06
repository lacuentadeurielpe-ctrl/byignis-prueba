'use client'

import { useEffect, useRef } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

interface NumberTickerProps {
  value: number
  format?: (val: number) => string
  className?: string
}

export function NumberTicker({ value, format = (val) => val.toString(), className }: NumberTickerProps) {
  const spring = useSpring(0, {
    mass: 1,
    stiffness: 75,
    damping: 15,
  })

  // Sincronizar el valor hacia el spring cada vez que cambia
  useEffect(() => {
    spring.set(value)
  }, [value, spring])

  // Transformar el valor flotante del spring en un string formateado
  const display = useTransform(spring, (current) => format(Math.round(current)))

  return <motion.span className={className}>{display}</motion.span>
}
