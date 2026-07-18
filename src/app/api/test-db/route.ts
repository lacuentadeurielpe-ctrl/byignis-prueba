import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(request: Request) {
  const admin = createAdminClient()
  const id = '32e14714-dfae-4a90-8cb9-41eb7d90a8d2'
  
  const { data, error } = await admin
    .from('ferreterias')
    .select('id, nombre, suscripciones(id, estado)')
    .eq('id', id)
    .single()
    
  return NextResponse.json({ data, error })
}
