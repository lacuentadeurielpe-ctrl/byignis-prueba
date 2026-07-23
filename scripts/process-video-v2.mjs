/**
 * process-video-v2.mjs
 * Optimiza el video para web SIN modificar el audio original.
 * - Video: H.264 CRF 26 + faststart (carga rápida)
 * - Audio: copia directa del original (sin filtros, sin tocar)
 */

import { createClient } from '@supabase/supabase-js'
import { spawn } from 'child_process'
import { readFileSync, statSync, unlinkSync, existsSync } from 'fs'
import { resolve } from 'path'

const FFMPEG = 'C:/Users/USER/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe'

const supabase = createClient(
  'https://copncsicoevhliaoxfpj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcG5jc2ljb2V2aGxpYW94ZnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDU2MzQsImV4cCI6MjA5NjAyMTYzNH0.YCPa6frtS0BWyqnrV4DK6Xcvl4Es_EpRk7bgIB2zeIA'
)

const LOCAL_INPUT  = resolve('C:/Users/USER/Downloads/avatar/partes vsl/vsl terminado.mp4')
const LOCAL_OUTPUT = resolve('C:/Users/USER/Downloads/avatar/partes vsl/vsl-web.mp4')

function processVideo() {
  return new Promise((resolve, reject) => {
    console.log('🎬 Procesando video (audio original intacto)...')
    console.log('   • Video: H.264 CRF 26 + faststart')
    console.log('   • Audio: COPIA DIRECTA — sin tocar\n')

    const args = [
      '-i', LOCAL_INPUT,
      // Video optimizado para web
      '-c:v', 'libx264',
      '-crf', '26',
      '-preset', 'slow',
      '-profile:v', 'high',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      // Audio: copia exacta del original, sin ningún filtro
      '-c:a', 'copy',
      '-y',
      LOCAL_OUTPUT
    ]

    const proc = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] })

    let stderr = ''
    proc.stderr.on('data', (data) => {
      stderr += data.toString()
      const match = stderr.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/)
      if (match) process.stdout.write(`\r   Progreso: ${match[1]}`)
    })

    proc.on('close', (code) => {
      if (code === 0) {
        const { size } = statSync(LOCAL_OUTPUT)
        const sizeMB = (size / 1024 / 1024).toFixed(1)
        console.log(`\n\n✅ Listo — ${sizeMB} MB`)
        resolve(sizeMB)
      } else {
        console.error('\n❌ Error FFmpeg')
        console.error(stderr.split('\n').slice(-10).join('\n'))
        reject(new Error(`FFmpeg código ${code}`))
      }
    })
  })
}

async function upload() {
  console.log('\n📤 Subiendo a Supabase Storage...')
  const buf = readFileSync(LOCAL_OUTPUT)
  const { data, error } = await supabase.storage
    .from('media')
    .upload('landing/hero-video.mp4', buf, {
      contentType: 'video/mp4',
      upsert: true,
      cacheControl: '31536000',
    })

  if (error) throw new Error(error.message)

  const url = supabase.storage.from('media').getPublicUrl('landing/hero-video.mp4').data.publicUrl
  console.log('✅ Subido:', data.path)
  console.log('🔗', url)
}

async function main() {
  const originalMB = (statSync(LOCAL_INPUT).size / 1024 / 1024).toFixed(1)
  console.log(`📊 Original: ${originalMB} MB\n`)

  await processVideo()

  const newMB = (statSync(LOCAL_OUTPUT).size / 1024 / 1024).toFixed(1)
  const orig = statSync(LOCAL_INPUT).size
  const nuevo = statSync(LOCAL_OUTPUT).size
  const pct = (((nuevo - orig) / orig) * 100).toFixed(0)

  console.log(`📊 Comparativa: ${originalMB} MB → ${newMB} MB (${pct}%)`)

  await upload()

  if (existsSync(LOCAL_OUTPUT)) unlinkSync(LOCAL_OUTPUT)
  console.log('\n🎉 ¡Listo! Audio original restaurado, video optimizado para web.')
}

main().catch(console.error)
