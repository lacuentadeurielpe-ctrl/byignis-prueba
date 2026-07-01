// POST /api/settings-2/integraciones/sunat-directo/homologar
// Emite 10 boletas de prueba en modo Beta para completar la homologación SUNAT.
// No requiere pedidos reales — usa items de prueba directamente.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionInfo } from '@/lib/auth/roles'
import { desencriptar } from '@/lib/encryption'

export const dynamic = 'force-dynamic'
export const maxDuration = 120  // 10 boletas × ~10s c/u

const GREENTER_URL = 'https://greenter-api-production.up.railway.app'
const CANTIDAD_HOMOLOGACION = 10

interface ResultadoBoleta {
  numero:          number
  ok:              boolean
  numero_completo?: string
  cdr_codigo?:     string
  error?:          string
}

export async function POST() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createAdminClient()

  // ── Cargar credenciales SUNAT activas ─────────────────────────────────────
  const { data: cred } = await supabase
    .from('sunat_credenciales')
    .select('*')
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('estado', 'activo')
    .single()

  if (!cred) {
    return NextResponse.json({ error: 'No hay credenciales SUNAT activas. Configura primero en Integraciones → SUNAT Directo.' }, { status: 400 })
  }

  if (cred.modo !== 'beta') {
    return NextResponse.json({ error: 'La homologación solo se puede realizar en modo Beta. Cambia el modo en la configuración.' }, { status: 400 })
  }

  if (cred.homologacion_completada_at) {
    return NextResponse.json({ error: 'La homologación ya fue completada el ' + cred.homologacion_completada_at }, { status: 400 })
  }

  // ── Desencriptar credenciales ──────────────────────────────────────────────
  let solUsuario: string, solClave: string, certPfxB64: string, certClave: string
  try {
    ;[solUsuario, solClave, certPfxB64, certClave] = await Promise.all([
      desencriptar(cred.sol_usuario_enc),
      desencriptar(cred.sol_clave_enc),
      desencriptar(cred.cert_pfx_enc),
      desencriptar(cred.cert_clave_enc),
    ])
  } catch {
    return NextResponse.json({ error: 'Error al desencriptar credenciales. Vuelve a guardarlas.' }, { status: 500 })
  }

  // ── Datos del emisor ───────────────────────────────────────────────────────
  const { data: ferr } = await supabase
    .from('ferreterias')
    .select('ruc, razon_social, serie_boletas, igv_incluido_en_precios, direccion')
    .eq('id', session.ferreteriaId)
    .single()

  if (!ferr) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 400 })
  }

  const serie       = ferr.serie_boletas ?? 'B001'
  const igvIncluido = ferr.igv_incluido_en_precios ?? false
  const resultados: ResultadoBoleta[] = []

  // ── Cuántas boletas de homologación ya fueron aceptadas ────────────────────
  // Fuente de verdad: comprobantes realmente emitidos. Permite acumular entre
  // corridas y completar solo las que faltan si una corrida fue parcial.
  const { count: yaAceptadas } = await supabase
    .from('comprobantes')
    .select('*', { count: 'exact', head: true })
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('emitido_por', 'homologacion_sunat')
    .eq('estado', 'emitido')

  const completadasPrevias = yaAceptadas ?? 0
  const faltantes = Math.max(0, CANTIDAD_HOMOLOGACION - completadasPrevias)

  // ── Emitir solo las boletas que faltan ─────────────────────────────────────
  for (let i = 0; i < faltantes; i++) {
    // Generar correlativo desde la función SQL (atómica, sin gaps)
    const { data: numero, error: corrErr } = await supabase.rpc('generar_numero_comprobante', {
      p_ferreteria_id: session.ferreteriaId,
      p_tipo:          'boleta',
      p_serie:         serie,
    })

    if (corrErr || !numero) {
      resultados.push({ numero: i + 1, ok: false, error: `Error correlativo: ${corrErr?.message ?? 'null'}` })
      continue
    }

    // Payload para el microservicio Greenter
    const payload = {
      modo: 'beta',
      emisor: {
        ruc:          ferr.ruc,
        razon_social: ferr.razon_social,
        serie,
        numero,
        direccion:    ferr.direccion ?? 'AV. LIMA 123',
        ubigeo:       '150101',
        departamento: 'LIMA',
        provincia:    'LIMA',
        distrito:     'LIMA',
      },
      sol:         { usuario: solUsuario, clave: solClave },
      certificado: { pfx_base64: certPfxB64, clave: certClave },
      cliente: {
        tipo_doc:   '0',
        numero_doc: '00000000',
        nombre:     'CLIENTES VARIOS',
      },
      igv_incluido: igvIncluido,
      items: [{
        descripcion:     `MATERIAL DE CONSTRUCCION TEST HOMOLOGACION ${i + 1}`,
        cantidad:        1,
        precio_unitario: 10.00,
        unidad:          'NIU',
      }],
    }

    try {
      // Reintenta una vez si el microservicio devuelve HTML en vez de JSON
      // (p.ej. justo durante un redeploy de Railway el contenedor viejo responde).
      let gr: {
        ok: boolean; numero_completo?: string
        pdf_url?: string; xml_url?: string
        cdr_codigo?: string; error?: string
      } | null = null

      for (let intento = 0; intento < 2 && !gr; intento++) {
        const res = await fetch(`${GREENTER_URL}/boleta/emitir`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
          signal:  AbortSignal.timeout(30_000),
        })
        const texto = await res.text()
        try {
          gr = JSON.parse(texto)
        } catch {
          if (intento === 0) { await new Promise(r => setTimeout(r, 2500)); continue }
          throw new Error('El servicio de facturación no respondió correctamente. Reintenta en unos segundos.')
        }
      }
      if (!gr) throw new Error('Sin respuesta del servicio de facturación')

      if (gr.ok) {
        // Guardar en comprobantes (sin pedido_id — comprobante de homologación)
        await supabase.from('comprobantes').insert({
          ferreteria_id:      session.ferreteriaId,
          tipo:               'boleta',
          serie,
          numero,
          numero_completo:    gr.numero_completo ?? `${serie}-${String(numero).padStart(8, '0')}`,
          numero_comprobante: gr.numero_completo ?? `${serie}-${String(numero).padStart(8, '0')}`,
          estado:             'emitido',
          pdf_url:            gr.pdf_url ?? null,
          xml_url:            gr.xml_url ?? null,
          cliente_nombre:     'CLIENTES VARIOS',
          emitido_por:        'homologacion_sunat',
        })

        resultados.push({
          numero,
          ok:              true,
          numero_completo: gr.numero_completo,
          cdr_codigo:      gr.cdr_codigo,
        })
      } else {
        resultados.push({ numero, ok: false, error: gr.error })
      }
    } catch (e) {
      resultados.push({
        numero,
        ok:    false,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  // ── Recontar el total real aceptado en BD (acumulado, fuente de verdad) ─────
  const { count: totalAceptadas } = await supabase
    .from('comprobantes')
    .select('*', { count: 'exact', head: true })
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('emitido_por', 'homologacion_sunat')
    .eq('estado', 'emitido')

  const completadas = totalAceptadas ?? 0
  const completado  = completadas >= CANTIDAD_HOMOLOGACION
  const ahora       = new Date().toISOString()

  await supabase
    .from('sunat_credenciales')
    .update({
      homologacion_casos_completados: completadas,
      ...(completado
        ? {
            homologacion_completada_at: ahora,
            modo: 'produccion',   // promover automáticamente a producción
          }
        : {}),
    })
    .eq('ferreteria_id', session.ferreteriaId)

  return NextResponse.json({
    exitosos:   completadas,               // acumulado, no solo esta corrida
    nuevas:     resultados.filter(r => r.ok).length,
    total:      CANTIDAD_HOMOLOGACION,
    completado,
    resultados,
  })
}
