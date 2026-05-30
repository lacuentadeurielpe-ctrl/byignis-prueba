'use client'

import { useRef, useState } from 'react'
import Barcode from 'react-barcode'
import { X, Printer } from 'lucide-react'

interface PrintBarcodeModalProps {
  producto: {
    nombre: string
    codigo_barras?: string | null
    precio_base: number
  }
  onClose: () => void
}

export default function PrintBarcodeModal({ producto, onClose }: PrintBarcodeModalProps) {
  const [copias, setCopias] = useState(1)
  const printRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    if (!printRef.current) return
    const content = printRef.current.innerHTML
    
    // Crear una ventana temporal para impresión limpia sin el resto de la interfaz web
    const printWindow = window.open('', '', 'width=800,height=600')
    if (!printWindow) return

    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir Etiquetas</title>
          <style>
            @page { margin: 0; }
            body { 
              margin: 0; 
              padding: 10px; 
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              flex-wrap: wrap;
              gap: 15px;
              justify-content: flex-start;
            }
            .etiqueta {
              width: 50mm; /* Ancho estándar de impresora térmica pequeña */
              height: 25mm;
              border: 1px dashed #ccc;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 2mm;
              box-sizing: border-box;
              page-break-inside: avoid;
            }
            .nombre {
              font-size: 10px;
              font-weight: bold;
              text-align: center;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              width: 100%;
              margin-bottom: 2px;
            }
            .precio {
              font-size: 11px;
              font-weight: 900;
              margin-top: 2px;
            }
            .barcode-svg {
              height: 12mm !important;
              width: 100% !important;
              max-width: 45mm;
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  // Si no tiene código, no podemos imprimir un barcode
  if (!producto.codigo_barras) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
          <p className="text-zinc-600 mb-4">Este producto no tiene un código de barras asignado. Edítalo primero para que se autogenere uno.</p>
          <button onClick={onClose} className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm">Cerrar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="font-bold text-zinc-800">Imprimir Etiquetas</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Previsualización */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex justify-center items-center">
            <div className="bg-white border border-dashed border-zinc-300 p-2 rounded shadow-sm w-[200px] flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold truncate w-full text-center">{producto.nombre}</span>
              <Barcode 
                value={producto.codigo_barras} 
                format="CODE128" 
                height={35} 
                width={1.5} 
                displayValue={true} 
                fontSize={12} 
                margin={2} 
              />
              <span className="text-xs font-black">S/ {producto.precio_base.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Cantidad de copias</label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                min={1} 
                value={copias} 
                onChange={(e) => setCopias(parseInt(e.target.value) || 1)}
                className="w-24 px-3 py-2 border border-zinc-200 rounded-lg text-center font-medium focus:outline-none focus:border-zinc-900"
              />
              <span className="text-sm text-zinc-500">etiquetas a imprimir</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-200/50 rounded-lg transition">Cancelar</button>
          <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-lg text-sm transition shadow-sm">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>

        {/* DOM oculto para renderizar la hoja de impresión */}
        <div className="hidden">
          <div ref={printRef}>
            {Array.from({ length: copias }).map((_, i) => (
              <div key={i} className="etiqueta">
                <div className="nombre">{producto.nombre}</div>
                <Barcode 
                  value={producto.codigo_barras!} 
                  format="CODE128" 
                  height={30} 
                  width={1.5} 
                  displayValue={true} 
                  fontSize={10} 
                  margin={0} 
                  background="transparent"
                />
                <div className="precio">S/ {producto.precio_base.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
