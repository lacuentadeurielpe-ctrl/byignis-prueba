'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScannerModalProps {
  onScan: (codigo: string) => void
  onClose: () => void
}

export default function ScannerModal({ onScan, onClose }: ScannerModalProps) {
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const idRef = useRef(`reader-${Math.floor(Math.random() * 10000)}`)

  useEffect(() => {
    // Inicializar el escáner al montar
    const scanner = new Html5Qrcode(idRef.current)
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' }, // Cámara trasera
      {
        fps: 10,
        qrbox: { width: 250, height: 150 }, // Aspect ratio más de código de barras
        aspectRatio: 1.0
      },
      (decodedText) => {
        // Cuando escanea correctamente, detenemos y retornamos
        if (scannerRef.current) {
          scannerRef.current.stop().then(() => {
            onScan(decodedText)
          }).catch(err => {
            console.error('Error stopping scanner:', err)
            // Emitimos de todas formas si hubo error al detener
            onScan(decodedText)
          })
        }
      },
      (errorMessage) => {
        // Errores de frame (ignorarlos, ocurren constantemente cuando no enfoca aún)
      }
    ).catch(err => {
      setError('No se pudo acceder a la cámara. Asegúrate de dar permisos.')
    })

    return () => {
      // Limpieza al desmontar
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error)
      }
    }
  }, [onScan])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-zinc-200">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white relative z-10">
          <h3 className="font-semibold text-zinc-900">Escanear Código</h3>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="relative bg-black min-h-[350px] flex items-center justify-center overflow-hidden">
          {error ? (
            <p className="text-red-400 text-sm text-center px-6">{error}</p>
          ) : (
            <div id={idRef.current} className="w-full h-full [&_video]:object-cover" />
          )}
          {/* Capa de estilo HUD/Láser */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            <div className="w-[250px] h-[150px] border-2 border-white/50 rounded-xl relative shadow-[0_0_0_4000px_rgba(0,0,0,0.5)]">
               {/* Esquinas destacadas */}
               <div className="absolute -top-0.5 -left-0.5 w-4 h-4 border-t-2 border-l-2 border-green-400 rounded-tl-xl" />
               <div className="absolute -top-0.5 -right-0.5 w-4 h-4 border-t-2 border-r-2 border-green-400 rounded-tr-xl" />
               <div className="absolute -bottom-0.5 -left-0.5 w-4 h-4 border-b-2 border-l-2 border-green-400 rounded-bl-xl" />
               <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 border-b-2 border-r-2 border-green-400 rounded-br-xl" />
               
               {/* Línea láser animada */}
               <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)] opacity-70" />
            </div>
          </div>
        </div>

        <div className="px-4 py-4 bg-zinc-50 border-t relative z-10">
          <p className="text-sm text-center text-zinc-600 font-medium">
            Centra el código de barras o QR en el recuadro.
          </p>
        </div>
      </div>
    </div>
  )
}
