import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SaasRepository } from '@/lib/db/repositories/saas'

// GET /api/settings — datos completos de la ferretería
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const saasRepo = new SaasRepository(supabase)

  try {
    const data = await saasRepo.obtenerFerreteriaPorDuenio(user.id)
    if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/settings — actualizar datos de la ferretería
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()

  // Campos de ferreterias (whitelist)
  const CAMPOS_FERRETERIA = [
    'nombre', 'direccion', 'telefono_whatsapp',
    'horario_apertura', 'horario_cierre', 'dias_atencion',
    'formas_pago', 'mensaje_bienvenida', 'mensaje_fuera_horario',
    'timeout_intervencion_dueno',
    'color_comprobante', 'mensaje_comprobante',
    'telefono_dueno', 'resumen_diario_activo',
    'modo_asignacion_delivery',
    'datos_yape', 'datos_plin', 'datos_transferencia', 'metodos_pago_activos',
    'tolerancia_dias_pago',
    'igv_incluido_en_precios',
  ]

  const update: Record<string, unknown> = {}
  for (const campo of CAMPOS_FERRETERIA) {
    if (campo in body) update[campo] = body[campo]
  }

  // Campos de configuracion_bot
  const BOT_CAMPOS = ['margen_minimo_porcentaje', 'debounce_segundos', 'ventana_gracia_minutos', 'perfil_bot', 'agentes_activos', 'cierre_cotizacion_activo', 'umbral_upsell_soles']
  const botUpdate: Record<string, unknown> = {}
  for (const campo of BOT_CAMPOS) {
    if (campo in body) botUpdate[campo] = body[campo]
  }

  if (Object.keys(update).length === 0 && Object.keys(botUpdate).length === 0)
    return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 })

  const saasRepo = new SaasRepository(supabase)

  try {
    const ferreteria = await saasRepo.obtenerFerreteriaPorDuenio(user.id)
    if (!ferreteria) return NextResponse.json({ error: 'Ferretería no encontrada' }, { status: 404 })

    // Actualizar ferreterias
    let data: unknown = null
    if (Object.keys(update).length > 0) {
      data = await saasRepo.actualizarFerreteria(user.id, update)
    }

    // Actualizar configuracion_bot si aplica
    if (Object.keys(botUpdate).length > 0) {
      await saasRepo.actualizarConfiguracionBot(ferreteria.id, botUpdate)
    }

    return NextResponse.json(data ?? { ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
