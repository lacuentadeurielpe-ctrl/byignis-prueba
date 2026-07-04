import { useState } from 'react'

export function useOrderComprobantes(pedidos: any[]) {
  const [modalBoleta, setModalBoleta] = useState<any | null>(null)
  const [modalFactura, setModalFactura] = useState<any | null>(null)
  const [modalNC, setModalNC] = useState<{ pedido: any, comprobanteOriginal: { id: string, numeroCompleto: string, tipo: string } } | null>(null)

  const [boletasEmitidas, setBoletasEmitidas] = useState<Record<string, { comprobanteId?: string; numeroCompleto: string; pdfUrl?: string; comprobanteSecundarioId?: string }>>(() => {
    const init: Record<string, { comprobanteId?: string; numeroCompleto: string; pdfUrl?: string; comprobanteSecundarioId?: string }> = {}
    for (const p of pedidos) {
      const b = p.comprobantes?.find((c: any) => c.tipo === 'boleta' && c.estado === 'emitido')
      if (b) {
        const nv = p.comprobantes?.find((c: any) => c.tipo === 'nota_venta')
        init[p.id] = { 
          comprobanteId: b.id,
          numeroCompleto: b.numero_completo, 
          pdfUrl: b.pdf_url ?? undefined,
          comprobanteSecundarioId: nv?.id 
        }
      }
    }
    return init
  })

  const [facturasEmitidas, setFacturasEmitidas] = useState<Record<string, { comprobanteId?: string; numeroCompleto: string; pdfUrl?: string; comprobanteSecundarioId?: string }>>(() => {
    const init: Record<string, { comprobanteId?: string; numeroCompleto: string; pdfUrl?: string; comprobanteSecundarioId?: string }> = {}
    for (const p of pedidos) {
      const f = p.comprobantes?.find((c: any) => c.tipo === 'factura' && c.estado === 'emitido')
      if (f) {
        const nv = p.comprobantes?.find((c: any) => c.tipo === 'nota_venta')
        init[p.id] = { 
          comprobanteId: f.id,
          numeroCompleto: f.numero_completo, 
          pdfUrl: f.pdf_url ?? undefined,
          comprobanteSecundarioId: nv?.id
        }
      }
    }
    return init
  })

  const [comprobantes, setComprobantes] = useState<Record<string, {
    id?: string
    numero_completo?: string
    tipo?: string
    url: string | null
    cargando: boolean
    reenviando: boolean
    enviado: boolean
    error: string | null
  }>>({})

  function estadoComprobante(pedidoId: string) {
    return comprobantes[pedidoId] ?? { url: null, cargando: false, reenviando: false, enviado: false, error: null }
  }

  function patchComprobante(pedidoId: string, patch: Partial<typeof comprobantes[string]>) {
    setComprobantes((prev) => ({
      ...prev,
      [pedidoId]: { ...estadoComprobante(pedidoId), ...patch },
    }))
  }

  function viewerUrl(pedidoId: string, comprobanteId?: string) {
    return `/api/orders/${pedidoId}/comprobante/view${comprobanteId ? `?id=${comprobanteId}` : ''}`
  }

  async function verComprobante(pedidoId: string, tipo?: string) {
    const cacheKey = tipo ? `${pedidoId}_${tipo}` : pedidoId
    const estado = estadoComprobante(cacheKey)
    if (estado.url) { window.open(viewerUrl(pedidoId, estado.id), '_blank'); return }

    patchComprobante(cacheKey, { cargando: true, error: null })
    try {
      const res = await fetch(`/api/orders/${pedidoId}/comprobante${tipo ? `?tipo=${tipo}` : ''}`)
      if (res.ok) {
        const data = await res.json()
        patchComprobante(cacheKey, { 
          id: data.id, 
          numero_completo: data.numero_completo || data.numero_comprobante, 
          tipo: data.tipo, 
          url: data.pdf_url || `/api/comprobantes/${data.id}/pdf`, 
          cargando: false 
        })
        window.open(viewerUrl(pedidoId, data.id), '_blank')
      } else if (res.status === 404 && (!tipo || tipo === 'nota_venta')) {
        const gen = await fetch(`/api/orders/${pedidoId}/comprobante`, { method: 'POST' })
        if (gen.ok) {
          const data = await gen.json()
          patchComprobante(cacheKey, { 
            id: data.comprobanteId, 
            numero_completo: data.numeroCompleto, 
            url: data.pdfUrl, 
            cargando: false 
          })
          window.open(viewerUrl(pedidoId, data.comprobanteId), '_blank')
        } else {
          throw new Error((await gen.json()).error ?? 'Error al generar')
        }
      } else {
        throw new Error((await res.json()).error ?? 'Error')
      }
    } catch (err: any) {
      patchComprobante(cacheKey, { cargando: false, error: err.message })
      alert(err.message)
    }
  }

  async function reenviarComprobante(pedidoId: string) {
    patchComprobante(pedidoId, { reenviando: true, enviado: false, error: null })
    try {
      const res = await fetch(`/api/orders/${pedidoId}/comprobante/reenviar`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error al reenviar')
      const data = await res.json()
      patchComprobante(pedidoId, { url: data.pdf_url, reenviando: false, enviado: true })
      setTimeout(() => patchComprobante(pedidoId, { enviado: false }), 3000)
    } catch (e) {
      patchComprobante(pedidoId, { reenviando: false, error: e instanceof Error ? e.message : 'Error' })
    }
  }

  function handleBoletaEmitida(pedidoId: string, resultado: any) {
    setBoletasEmitidas((prev) => ({ ...prev, [pedidoId]: resultado }))
    if (resultado.pdfUrlSecundario) {
      setTimeout(() => window.open(resultado.pdfUrlSecundario, '_blank'), 100)
    }
    setModalBoleta(null)
  }

  function handleFacturaEmitida(pedidoId: string, resultado: any) {
    setFacturasEmitidas((prev) => ({ ...prev, [pedidoId]: resultado }))
    if (resultado.pdfUrlSecundario) {
      setTimeout(() => window.open(resultado.pdfUrlSecundario, '_blank'), 100)
    }
    setModalFactura(null)
  }

  return {
    modalBoleta, setModalBoleta,
    modalFactura, setModalFactura,
    modalNC, setModalNC,
    boletasEmitidas,
    facturasEmitidas,
    estadoComprobante,
    verComprobante,
    reenviarComprobante,
    handleBoletaEmitida,
    handleFacturaEmitida
  }
}
