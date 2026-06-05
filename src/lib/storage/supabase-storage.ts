import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Usamos el service role para saltarnos RLS en la subida desde el backend
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function subirImagenComprobante(base64Image: string, mimeType: string, ferreteriaId: string): Promise<string> {
  const extension = mimeType.split('/')[1] || 'jpg'
  const fileName = `${ferreteriaId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`
  
  const buffer = Buffer.from(base64Image, 'base64')

  const { data, error } = await supabaseAdmin.storage
    .from('comprobantes_ai')
    .upload(fileName, buffer, {
      contentType: mimeType,
      upsert: false
    })

  if (error) {
    console.error('Error al subir imagen a Supabase Storage:', error)
    throw new Error('No se pudo guardar la imagen del comprobante.')
  }

  // Devolver URL pública
  const { data: publicUrlData } = supabaseAdmin.storage
    .from('comprobantes_ai')
    .getPublicUrl(fileName)

  return publicUrlData.publicUrl
}
