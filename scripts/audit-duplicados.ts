/**
 * scripts/audit-duplicados.ts
 *
 * Auditoría de integridad de datos: detecta duplicados en miembros_ferreteria,
 * owner_ids duplicados en ferreterias, RUCs compartidos y series desincronizadas.
 *
 * Ejecutar ANTES de la migración 116:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/audit-duplicados.ts
 *
 * No modifica ningún dato — solo lectura.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceKey) {
  console.error('ERROR: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── helpers ────────────────────────────────────────────────────────────────────

function printSection(title: string) {
  console.log('\n' + '═'.repeat(60))
  console.log(`  ${title}`)
  console.log('═'.repeat(60))
}

function ok(msg: string) { console.log(`  ✅  ${msg}`) }
function warn(msg: string) { console.log(`  ⚠️  ${msg}`) }
function err(msg: string) { console.log(`  ❌  ${msg}`) }

// ── 1. Duplicados en miembros_ferreteria por (ferreteria_id, user_id) ─────────

async function auditMiembrosDuplicados() {
  printSection('1. Duplicados en miembros_ferreteria (ferreteria_id, user_id)')

  const { data, error } = await supabase.rpc('exec_sql_audit', {
    query: `
      SELECT
        ferreteria_id,
        user_id,
        COUNT(*) AS total,
        array_agg(id ORDER BY created_at) AS ids,
        array_agg(rol ORDER BY created_at) AS roles,
        array_agg(activo ORDER BY created_at) AS activos,
        array_agg(created_at ORDER BY created_at) AS fechas
      FROM miembros_ferreteria
      WHERE user_id IS NOT NULL
      GROUP BY ferreteria_id, user_id
      HAVING COUNT(*) > 1
      ORDER BY total DESC
    `
  })

  // Fallback: consulta directa vía .from() si no existe el RPC
  if (error?.code === 'PGRST202') {
    // RPC no existe — usamos consulta REST estándar
    const { data: rows } = await supabase
      .from('miembros_ferreteria')
      .select('id, ferreteria_id, user_id, rol, activo, created_at')
      .order('created_at', { ascending: true })

    if (!rows || rows.length === 0) { ok('Sin registros en miembros_ferreteria'); return }

    // Agrupar en JS
    const grupos = new Map<string, typeof rows>()
    for (const row of rows) {
      const key = `${row.ferreteria_id}::${row.user_id}`
      if (!grupos.has(key)) grupos.set(key, [])
      grupos.get(key)!.push(row)
    }

    let hayDuplicados = false
    for (const [key, filas] of grupos) {
      if (filas.length > 1) {
        hayDuplicados = true
        err(`Duplicado: clave (ferreteria_id, user_id) = ${key}`)
        for (const f of filas) {
          console.log(`       id=${f.id}  rol=${f.rol}  activo=${f.activo}  created_at=${f.created_at}`)
        }
        const conservar = filas.find(f => f.activo) ?? filas[0]
        warn(`  → La migración conservará: id=${conservar.id} (activo=${conservar.activo}, más antiguo con prioridad)`)
      }
    }
    if (!hayDuplicados) ok('Sin duplicados detectados')
    return
  }

  if (error) { err(`Error en consulta: ${error.message}`); return }
  if (!data || data.length === 0) { ok('Sin duplicados detectados'); return }

  for (const row of data) {
    err(`Duplicado — ferreteria_id=${row.ferreteria_id}  user_id=${row.user_id}  total=${row.total}`)
    console.log(`       IDs:     ${row.ids.join(', ')}`)
    console.log(`       Roles:   ${row.roles.join(', ')}`)
    console.log(`       Activos: ${row.activos.join(', ')}`)
    console.log(`       Fechas:  ${row.fechas.join(', ')}`)
  }
}

// ── 2. Usuarios que son owner Y también miembro de la misma ferretería ─────────

async function auditOwnerYMiembro() {
  printSection('2. Usuarios que son owner Y miembro de la misma ferretería')

  const { data: ferreterias } = await supabase
    .from('ferreterias')
    .select('id, owner_id, nombre')

  const { data: miembros } = await supabase
    .from('miembros_ferreteria')
    .select('id, ferreteria_id, user_id, rol, activo')

  if (!ferreterias || !miembros) { err('Error cargando datos'); return }

  const ownerSet = new Map(ferreterias.map(f => [f.owner_id, f]))
  let encontrado = false

  for (const m of miembros) {
    const ferr = ownerSet.get(m.user_id)
    if (ferr && ferr.id === m.ferreteria_id) {
      encontrado = true
      err(`Usuario owner=${m.user_id} también es miembro (id=${m.id}) en su misma ferretería "${ferr.nombre}"`)
      warn('  → Este registro en miembros_ferreteria es redundante. La migración lo eliminará.')
    }
  }

  if (!encontrado) ok('Ningún owner aparece duplicado como miembro en su propia ferretería')
}

// ── 3. owner_id duplicados en ferreterias (un user con 2 ferreterías) ──────────

async function auditOwnersDuplicados() {
  printSection('3. owner_id duplicados en ferreterias (un usuario con 2+ ferreterías)')

  const { data } = await supabase
    .from('ferreterias')
    .select('id, owner_id, nombre, created_at')
    .order('created_at', { ascending: true })

  if (!data) { err('Error cargando ferreterias'); return }

  const por_owner = new Map<string, typeof data>()
  for (const f of data) {
    if (!por_owner.has(f.owner_id)) por_owner.set(f.owner_id, [])
    por_owner.get(f.owner_id)!.push(f)
  }

  let encontrado = false
  for (const [owner_id, filas] of por_owner) {
    if (filas.length > 1) {
      encontrado = true
      err(`owner_id=${owner_id} tiene ${filas.length} ferreterías:`)
      for (const f of filas) {
        console.log(`       id=${f.id}  nombre="${f.nombre}"  created_at=${f.created_at}`)
      }
      warn('  → El constraint UNIQUE(owner_id) fallará si existe esto. Requiere decisión manual.')
    }
  }

  if (!encontrado) ok('Sin owners con múltiples ferreterías detectados')
}

// ── 4. RUCs compartidos en sunat_credenciales entre ferreterías distintas ──────

async function auditRucsCompartidos() {
  printSection('4. RUCs compartidos en sunat_credenciales entre ferreterías distintas')

  const { data } = await supabase
    .from('sunat_credenciales')
    .select('id, ferreteria_id, ruc, razon_social, estado, modo')
    .order('ruc')

  if (!data || data.length === 0) { ok('Sin credenciales SUNAT registradas'); return }

  const por_ruc = new Map<string, typeof data>()
  for (const c of data) {
    if (!por_ruc.has(c.ruc)) por_ruc.set(c.ruc, [])
    por_ruc.get(c.ruc)!.push(c)
  }

  let encontrado = false
  for (const [ruc, filas] of por_ruc) {
    if (filas.length > 1) {
      encontrado = true
      err(`RUC=${ruc} está configurado en ${filas.length} ferreterías distintas:`)
      for (const f of filas) {
        console.log(`       ferreteria_id=${f.ferreteria_id}  estado=${f.estado}  modo=${f.modo}`)
      }
      warn('  ⚡ CRÍTICO: Dos ferreterías con el mismo RUC y la misma serie generarán')
      warn('             correlativos duplicados → SUNAT rechazará documentos.')
    }
  }

  if (!encontrado) ok('Sin RUCs compartidos entre ferreterías')
}

// ── 5. Series desincronizadas: correlativo en sunat_series vs MAX en comprobantes

async function auditSeriesDesincronizadas() {
  printSection('5. Series con posible desincronización (sunat_series vs comprobantes)')

  const { data: series } = await supabase
    .from('sunat_series')
    .select('id, ferreteria_id, tipo_doc, serie, correlativo_actual')

  const { data: comprobantes } = await supabase
    .from('comprobantes')
    .select('ferreteria_id, tipo, serie, numero')
    .not('numero', 'is', null)

  if (!series || !comprobantes) { err('Error cargando datos de series o comprobantes'); return }

  // Calcular MAX por (ferreteria_id, tipo_doc equivalente, serie)
  const tipoMap: Record<string, string> = { 'boleta': '03', 'factura': '01', 'nota_credito': '07', 'nota_debito': '08' }
  const maxEnComprobantes = new Map<string, number>()
  for (const c of comprobantes) {
    const tipo_doc = tipoMap[c.tipo] ?? c.tipo
    const key = `${c.ferreteria_id}::${tipo_doc}::${c.serie}`
    const actual = maxEnComprobantes.get(key) ?? 0
    if ((c.numero ?? 0) > actual) maxEnComprobantes.set(key, c.numero!)
  }

  let encontrado = false
  for (const s of series) {
    const key = `${s.ferreteria_id}::${s.tipo_doc}::${s.serie}`
    const maxDb = maxEnComprobantes.get(key) ?? 0
    if (s.correlativo_actual < maxDb) {
      encontrado = true
      err(`Serie desincronizada: ferreteria_id=${s.ferreteria_id} tipo=${s.tipo_doc} serie=${s.serie}`)
      console.log(`       correlativo_actual en sunat_series = ${s.correlativo_actual}`)
      console.log(`       MAX(numero) en comprobantes         = ${maxDb}`)
      warn(`  → La migración actualizará correlativo_actual a ${maxDb} para evitar colisión`)
    }
  }

  if (!encontrado) ok('Todos los correlativos están sincronizados')
}

// ── main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔍  AUDITORÍA DE INTEGRIDAD DE DATOS — byignis')
  console.log('    Solo lectura. No modifica ningún dato.')
  console.log(`    Proyecto: ${supabaseUrl}`)

  await auditMiembrosDuplicados()
  await auditOwnerYMiembro()
  await auditOwnersDuplicados()
  await auditRucsCompartidos()
  await auditSeriesDesincronizadas()

  console.log('\n' + '═'.repeat(60))
  console.log('  Auditoría completada.')
  console.log('  Si ves ❌, aplica la migración 116 para corregir.')
  console.log('  Si ves ⚠️ en RUC compartido, esa situación requiere')
  console.log('  decisión manual (cambiar serie en una de las ferreterías).')
  console.log('═'.repeat(60) + '\n')
}

main().catch(e => { console.error(e); process.exit(1) })
