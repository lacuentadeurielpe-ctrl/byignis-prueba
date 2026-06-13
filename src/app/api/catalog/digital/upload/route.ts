import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionInfo } from '@/lib/auth/roles'

const BUCKET = 'productos-digitales'
const MAX_SIZE = 50 * 1024 * 1024

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Formato de solicitud inválido' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'El archivo no puede superar 50 MB' }, { status: 400 })

  const supabaseAdmin = createAdminClient()

  await supabaseAdmin.storage.createBucket(BUCKET, { public: true }).catch(() => {})

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const filename = `${session.ferreteriaId}/${crypto.randomUUID()}.${ext}`
  const bytes = await file.arrayBuffer()

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filename, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filename)
  return NextResponse.json({ url: urlData.publicUrl, nombre: file.name })
}
