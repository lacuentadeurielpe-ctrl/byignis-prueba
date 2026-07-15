import { Clock, Zap } from 'lucide-react'

export default function PagosPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-8 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-800/50 dark:to-zinc-900">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Clock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
          <Zap className="w-3 h-3 text-white" />
        </div>
      </div>

      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
        Pagos y Asistencia
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-md leading-relaxed">
        Aquí podrás registrar asistencias, gestionar nóminas, calcular bonos y
        generar recibos de pago para todo tu equipo.
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg">
        {[
          { label: 'Control de asistencia', desc: 'Entradas y salidas' },
          { label: 'Nóminas mensuales', desc: 'Cálculo automático' },
          { label: 'Recibos de pago', desc: 'Generación en PDF' },
        ].map((f) => (
          <div
            key={f.label}
            className="p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-center"
          >
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{f.label}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{f.desc}</p>
          </div>
        ))}
      </div>

      <span className="mt-8 px-4 py-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-semibold rounded-full">
        En construcción — próximamente
      </span>
    </div>
  )
}
