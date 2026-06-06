'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition overflow-hidden group"
      aria-label="Alternar tema"
    >
      <motion.div
        initial={false}
        animate={{ 
          y: isDark ? 24 : 0, 
          opacity: isDark ? 0 : 1,
          scale: isDark ? 0.5 : 1
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="absolute"
      >
        <Sun className="w-4 h-4" />
      </motion.div>
      <motion.div
        initial={false}
        animate={{ 
          y: isDark ? 0 : -24, 
          opacity: isDark ? 1 : 0,
          scale: isDark ? 1 : 0.5
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="absolute"
      >
        <Moon className="w-4 h-4" />
      </motion.div>
    </button>
  )
}
