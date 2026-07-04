'use client'

import { useState, useEffect } from 'react'
import { ShieldCheck, AlertTriangle, RefreshCw, Clock3 } from 'lucide-react'

interface Excepcion {
  tipo:        string
  mensaje:     string
  referencia?: string
}

interface AnulacionEnTramite {
  id:                     string
  numero_completo:        string | null
  tipo:                   string | null
  estado_sunat:           string | null
  anulacion_solicitada_at: string | null
}

interface SaludFiscal {
  semaforo: {
    aceptados:    number
    enReintento:  number
    rechazados:   number
    anulados:     number
    totalMes:     number
  }
  excepciones:          Excepcion[]
  anulacionesEnTramite: AnulacionEnTramite[]
}

// El sistema declara e informa cada comprobante solo, en el momento de la venta.
// La única intervención humana que queda es decidir una anulación o revisar una
// excepción — todo lo demás corre en segundo plano (reintentos, RC/RA de baja).
export default function SaludFiscalPanel() {
  const [datos, setDatos]   = useState<SaludFiscal | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/comprobantes/salud-fiscal')
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Error al cargar'); return }
      setDatos(d)
    } catch {
      setError('Error de red al cargar la salud fiscal')
    } finally {
      setCargando(false)
    }
  }

  if (cargando) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-2 text-sm text-gray-400">
        <RefreshCw className="w-4 h-4 animate-spin" /> Cargando salud fiscal...
      </div>
    )
  }

  if (error || !datos) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
        {error ?? 'No se pudo cargar la salud fiscal'}
      </div>
    )
  }

  const { semaforo, excepciones, anulacionesEnTramite } = datos
  const todoBien = excepciones.length === 0

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            {todoBien
              ? <ShieldCheck className="w-4 h-4 text-emerald-600" />
              : <AlertTriangle className="w-4 h-4 text-amber-600" />
            }
            Salud Fiscal — este mes
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Cada venta declara su comprobante sola ante SUNAT. Aquí solo aparece lo que necesita tu decisión.
          </p>
        </div>
        <button
          onClick={cargar}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 text-xs rounded-lg transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>

      {/* Semáforo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
          <p className="text-xs text-emerald-700 font-medium">Aceptados</p>
          <p className="text-lg font-bold text-emerald-800 mt-0.5">{semaforo.aceptados}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
          <p className="text-xs text-blue-700 font-medium">En reintento</p>
          <p className="text-lg font-bold text-blue-800 mt-0.5">{semaforo.enReintento}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
          <p className="text-xs text-red-700 font-medium">Rechazados</p>
          <p className="text-lg font-bold text-red-800 mt-0.5">{semaforo.rechazados}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
          <p className="text-xs text-gray-500 font-medium">Anulados</p>
          <p className="text-lg font-bold text-gray-700 mt-0.5">{semaforo.anulados}</p>
        </div>
      </div>

      {/* Bandeja de excepciones — lo único que requiere acción humana */}
      {todoBien ? (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          Todo en orden. No hay comprobantes que requieran tu atención.
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-500 font-semibold mb-2">Requiere tu atención:</p>
          <div className="space-y-2">
            {excepciones.map((e, i) => (
              <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{e.mensaje}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anulaciones en trámite — para que el dueño vea que no quedaron olvidadas */}
      {anulacionesEnTramite.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 font-semibold mb-2 flex items-center gap-1.5">
            <Clock3 className="w-3.5 h-3.5" /> Anulaciones en trámite (se procesan solas por la noche):
          </p>
          <div className="space-y-1.5">
            {anulacionesEnTramite.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">
                <span className="font-medium text-gray-800">{a.numero_completo ?? 'Comprobante'}</span>
                <span className="text-gray-400">
                  {a.estado_sunat === 'baja_pendiente' ? 'Enviada a SUNAT, esperando CDR' : 'Pendiente de procesar'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
