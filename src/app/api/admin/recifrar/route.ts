// RUTA TEMPORAL de mantenimiento — re-cifra credenciales guardadas como "plain:".
//
// Contexto: antes de configurar ENCRYPTION_KEY en Vercel, encriptar() guardaba los
// valores con prefijo "plain:" (sin cifrar). Esta ruta los convierte al formato
// AES-256-GCM real usando la llave ya cargada en el entorno.
//
// Auth: Bearer <ENCRYPTION_KEY> — solo quien posee la llave maestra puede invocarla.
// Idempotente: los valores ya cifrados (sin prefijo plain:) se dejan intactos.
// ELIMINAR esta ruta después de ejecutar la migración.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encriptar } from '@/lib/encryption'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Tablas con columnas cifradas y su clave primaria
const TABLAS: Record<string, { pk: string; cols: string[] }> = {
  sunat_credenciales:        { pk: 'id', cols: ['sol_usuario_enc', 'sol_clave_enc', 'cert_pfx_enc', 'cert_clave_enc', 'cert_pem_enc'] },
  configuracion_ycloud:      { pk: 'id', cols: ['api_key_enc', 'webhook_secret_enc'] },
  configuracion_meta:        { pk: 'ferreteria_id', cols: ['access_token_enc'] },
  configuracion_mercadopago: { pk: 'id', cols: ['access_token_enc', 'refresh_token_enc'] },
  ferreterias:               { pk: 'id', cols: ['nubefact_token_enc'] },
}

export async function POST(request: Request) {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    return NextResponse.json({ error: 'ENCRYPTION_KEY no configurada en el servidor' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${key}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const resumen: Record<string, number | string> = {}

  for (const [tabla, { pk, cols }] of Object.entries(TABLAS)) {
    const { data: rows, error } = await supabase.from(tabla).select([pk, ...cols].join(','))
    if (error) { resumen[tabla] = `error: ${error.message}`; continue }

    let recifrados = 0
    for (const row of (rows ?? []) as any[]) {
      const updates: Record<string, string> = {}
      for (const col of cols) {
        const valor = row[col]
        if (typeof valor === 'string' && valor.startsWith('plain:')) {
          updates[col] = await encriptar(valor.slice(6))
        }
      }
      if (Object.keys(updates).length > 0) {
        const { error: errUpd } = await supabase.from(tabla).update(updates).eq(pk, row[pk])
        if (errUpd) { resumen[tabla] = `error update: ${errUpd.message}` }
        else recifrados += Object.keys(updates).length
      }
    }
    if (!(tabla in resumen)) resumen[tabla] = recifrados
  }

  return NextResponse.json({ ok: true, valores_recifrados: resumen })
}
