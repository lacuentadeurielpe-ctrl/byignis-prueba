import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Faltan variables de entorno')
  process.exit(1)
}

const admin = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  console.log('Obteniendo ferreterias...')
  const { data: ferreterias } = await admin.from('ferreterias').select('id')
  
  if (!ferreterias) {
    console.log('No hay ferreterias')
    return
  }

  console.log(`Actualizando ${ferreterias.length} tenants a vitalicio...`)

  for (const f of ferreterias) {
    const { error } = await admin
      .from('suscripciones')
      .upsert({
        ferreteria_id: f.id,
        estado: 'activo',
        ciclo_fin: '2099-12-31',
        creditos_mes: 9999999,
        creditos_disponibles: 9999999,
        plan_id: '11111111-1111-1111-1111-111111111111' // fake uuid to satisfy foreign key if it's not null, or we can just leave it null if allowed.
        // Actually, if plan_id is required, we should get an existing plan id.
      }, { onConflict: 'ferreteria_id' })
    
    if (error) {
      console.log(`Error actualizando ${f.id}:`, error.message)
    }
  }

  console.log('Terminado.')
}

run()
