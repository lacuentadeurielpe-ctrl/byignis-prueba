import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const admin = createAdminClient()
    
    // Add placa to vehiculos
    const { error: err1 } = await admin.rpc('exec_sql', { sql_query: 'ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS placa text;' })
    if (err1 && !err1.message.includes('exec_sql')) {
      console.error(err1)
    }

    // Add dni to repartidores
    const { error: err2 } = await admin.rpc('exec_sql', { sql_query: 'ALTER TABLE repartidores ADD COLUMN IF NOT EXISTS dni text;' })
    if (err2 && !err2.message.includes('exec_sql')) {
      console.error(err2)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message })
  }
}
