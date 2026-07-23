import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const supabase = createClient(
  'https://copncsicoevhliaoxfpj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcG5jc2ljb2V2aGxpYW94ZnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDU2MzQsImV4cCI6MjA5NjAyMTYzNH0.YCPa6frtS0BWyqnrV4DK6Xcvl4Es_EpRk7bgIB2zeIA'
)

console.log('📤 Leyendo video optimizado...')
const buf = readFileSync('C:/Users/USER/Downloads/avatar/partes vsl/vsl-optimizado.mp4')
console.log(`   Tamaño: ${(buf.length / 1024 / 1024).toFixed(1)} MB`)
console.log('   Subiendo a Supabase...')

const { data, error } = await supabase.storage
  .from('media')
  .upload('landing/hero-video.mp4', buf, {
    contentType: 'video/mp4',
    upsert: true,
    cacheControl: '31536000',
  })

if (error) {
  console.error('❌ Error:', error.message)
} else {
  const url = supabase.storage.from('media').getPublicUrl('landing/hero-video.mp4').data.publicUrl
  console.log('✅ Subido:', data.path)
  console.log('🔗 URL:', url)
}
