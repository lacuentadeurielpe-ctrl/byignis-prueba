import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  console.log("Buscando comprobantes recientes...")
  const { data, error } = await supabase
    .from('comprobantes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error("Error al buscar comprobantes:", error)
    return
  }
  
  if (!data || data.length === 0) {
    console.log("No hay comprobantes recientes.")
    return
  }

  for (const c of data) {
    console.log(`- ID: ${c.id}`)
    console.log(`  Tipo: ${c.tipo}`)
    console.log(`  Número Completo: ${c.numero_completo}`)
    console.log(`  Cliente: ${c.cliente_nombre} (${c.cliente_ruc_dni})`)
    console.log(`  Estado: ${c.estado}`)
    console.log(`  Estado SUNAT: ${c.estado_sunat}`)
    console.log(`  Último error SUNAT: ${c.ultimo_error_sunat}`)
    console.log(`  Intentos: ${c.intentos_envio}`)
    console.log(`  Requiere atención: ${c.requiere_atencion}`)
    console.log(`  Creado en: ${c.created_at}`)
    console.log('---')
  }

  console.log("Buscando usuario lacuentadefoxpdf@gmail.com ...")
  const { data: users, error: uErr } = await supabase.auth.admin.listUsers()
  if (users) {
      const user = users.users.find(u => u.email === 'lacuentadefoxpdf@gmail.com')
      if (user) {
          console.log(`Usuario encontrado: ${user.id}`)
          // buscar a qué ferretería pertenece
          const { data: empl, error: eErr } = await supabase.from('empleados').select('*').eq('id', user.id).single()
          if (empl) {
              console.log(`Empleado ferretería: ${empl.ferreteria_id}`)
              
              console.log("Buscando logs de envío...")
              const { data: logs, error: lErr } = await supabase
                .from('api_logs')
                .select('*')
                .eq('ferreteria_id', empl.ferreteria_id)
                .order('created_at', { ascending: false })
                .limit(5)
              if (logs) {
                  for (const l of logs) {
                      console.log(`Log [${l.created_at}] - ${l.action} / ${l.entity}:`, JSON.stringify(l.details).substring(0, 200))
                  }
              }
          }
      }
  }
}

check()
