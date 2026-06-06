import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { VentasRepository } from '@/lib/db/repositories/ventas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const ventasRepo = new VentasRepository(supabase)
  const fid = session.ferreteriaId

  try {
    const [feedPedidos, feedCotizaciones, feedPagos] = await Promise.all([
      ventasRepo.obtenerFeedPedidos(fid, 14),
      ventasRepo.obtenerFeedCotizaciones(fid, 6),
      ventasRepo.obtenerFeedPagos(fid, 5),
    ])

    type FeedEntry = { 
      id: string; 
      type: 'pedido' | 'cotizacion' | 'pago';
      estado: string;
      titulo: string; 
      subtitulo: string; 
      ts: string; 
      href: string 
    }

    const feed: FeedEntry[] = [
      ...(feedPedidos ?? []).map((p: any) => ({
        id: 'p_' + p.id, 
        type: 'pedido' as const,
        estado: p.estado,
        titulo: p.estado, // El cliente lo mapeará visualmente
        subtitulo: `${p.nombre_cliente} · ${p.numero_pedido}`,
        ts: p.updated_at, 
        href: `/dashboard/ventas?tab=pedidos&pedido_id=${p.id}`,
      })),
      ...(feedCotizaciones ?? []).map((c: any) => ({
        id: 'c_' + c.id, 
        type: 'cotizacion' as const,
        estado: 'cotizacion',
        titulo: 'Cotización enviada', 
        subtitulo: (c.clientes as { nombre?: string } | null)?.nombre ?? 'cliente',
        ts: c.created_at, 
        href: `/dashboard/ventas?tab=cotizaciones&cotizacion_id=${c.id}`,
      })),
      ...(feedPagos ?? []).map((p: any) => ({
        id: 'pg_' + p.id,
        type: 'pago' as const,
        estado: p.estado,
        titulo: 'Pago recibido',
        subtitulo: `S/${p.monto} · ${(p.clientes as { nombre?: string } | null)?.nombre ?? 'cliente'}`,
        ts: p.registrado_at, 
        href: `/dashboard/ventas?tab=pagos&pago_id=${p.id}`,
      })),
    ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 9)

    return NextResponse.json({ feed })
  } catch (err) {
    console.error('Error en /api/dashboard/feed:', err)
    return NextResponse.json({ error: 'Error cargando feed' }, { status: 500 })
  }
}
