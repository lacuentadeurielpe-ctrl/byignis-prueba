'use client'

import { useTheme } from 'next-themes'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { useEffect, useState } from 'react'

interface DayData {
  dia: string
  pedidos: number
  cotizaciones: number
}

interface ActivityChartProps {
  datos: DayData[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-xl">
        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-zinc-500 dark:text-zinc-400 capitalize">{entry.name}:</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function ActivityChart({ datos }: ActivityChartProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return <div className="w-full h-[180px] animate-pulse bg-zinc-100 dark:bg-zinc-800/50 rounded-lg" />

  const isDark = resolvedTheme === 'dark'

  // Colores dinámicos
  const colorPrimary = isDark ? '#ffffff' : '#18181b' // Pedidos
  const colorSecondary = isDark ? '#52525b' : '#a1a1aa' // Cotizaciones
  const gridColor = isDark ? '#27272a' : '#f4f4f5'
  const tickColor = isDark ? '#71717a' : '#a1a1aa'

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={datos} margin={{ top: 10, right: 0, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="gPrimary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colorPrimary} stopOpacity={0.3} />
            <stop offset="95%" stopColor={colorPrimary} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gSecondary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colorSecondary} stopOpacity={0.4} />
            <stop offset="95%" stopColor={colorSecondary} stopOpacity={0} />
          </linearGradient>
        </defs>
        
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
        
        <XAxis 
          dataKey="dia" 
          tick={{ fontSize: 11, fill: tickColor }} 
          tickLine={false}
          axisLine={false}
          dy={10}
        />
        
        <YAxis 
          allowDecimals={false} 
          tick={{ fontSize: 11, fill: tickColor }} 
          tickLine={false}
          axisLine={false}
        />
        
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: gridColor, strokeWidth: 1, strokeDasharray: '4 4' }} />
        
        <Legend 
          iconType="circle" 
          iconSize={8} 
          wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
        />
        
        <Area 
          type="monotone" 
          dataKey="cotizaciones" 
          name="Cotizaciones"
          stroke={colorSecondary} 
          strokeWidth={2} 
          fill="url(#gSecondary)" 
        />
        <Area 
          type="monotone" 
          dataKey="pedidos" 
          name="Pedidos"
          stroke={colorPrimary} 
          strokeWidth={2} 
          fill="url(#gPrimary)" 
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
