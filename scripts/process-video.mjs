/**
 * process-video.mjs
 * 
 * 1. Descarga el video desde Supabase Storage
 * 2. Lo procesa con FFmpeg:
 *    - Reduce reverberación del audio (afftdn + compand)
 *    - Recodifica para web-optimizado (H.264 faststart, CRF 26)
 *    - Baja bitrate audio a 128k (suficiente para voz)
 *    - Agrega -movflags faststart (el video empieza ANTES de terminar de cargar)
 * 3. Sube el resultado procesado de vuelta a Supabase Storage (sobreescribe)
 */

import { createClient } from '@supabase/supabase-js'
import { execSync, spawn } from 'child_process'
import { createWriteStream, readFileSync, statSync, unlinkSync, existsSync } from 'fs'
import { resolve } from 'path'
import https from 'https'
import http from 'http'

const SUPABASE_URL = 'https://copncsicoevhliaoxfpj.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcG5jc2ljb2V2aGxpYW94ZnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDU2MzQsImV4cCI6MjA5NjAyMTYzNH0.YCPa6frtS0BWyqnrV4DK6Xcvl4Es_EpRk7bgIB2zeIA'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Ruta completa a FFmpeg (winget lo instala aquí)
const FFMPEG = 'C:/Users/USER/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe'
const FFPROBE = 'C:/Users/USER/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffprobe.exe'

const BUCKET = 'media'
const REMOTE_PATH = 'landing/hero-video.mp4'
const LOCAL_INPUT  = resolve('C:/Users/USER/Downloads/avatar/partes vsl/vsl terminado.mp4')
const LOCAL_OUTPUT = resolve('C:/Users/USER/Downloads/avatar/partes vsl/vsl-optimizado.mp4')

// ── Paso 1: Verificar FFmpeg ────────────────────────────────────────────────
function checkFFmpeg() {
  try {
    const version = execSync(`"${FFMPEG}" -version`, { encoding: 'utf8' }).split('\n')[0]
    console.log('✅ FFmpeg encontrado:', version)
    return true
  } catch (e) {
    console.error('❌ FFmpeg no encontrado en:', FFMPEG)
    console.error(e.message)
    process.exit(1)
  }
}

// ── Paso 2: Obtener info del video original ─────────────────────────────────
function getVideoInfo() {
  const stats = statSync(LOCAL_INPUT)
  const sizeMB = (stats.size / 1024 / 1024).toFixed(1)
  
  try {
    const info = execSync(
      `"${FFPROBE}" -v quiet -print_format json -show_streams -show_format "${LOCAL_INPUT}"`,
      { encoding: 'utf8' }
    )
    const data = JSON.parse(info)
    const video = data.streams.find(s => s.codec_type === 'video')
    const audio = data.streams.find(s => s.codec_type === 'audio')
    const duration = parseFloat(data.format.duration).toFixed(1)
    
    console.log(`\n📊 Video original:`)
    console.log(`   Tamaño:     ${sizeMB} MB`)
    console.log(`   Duración:   ${duration}s`)
    console.log(`   Video:      ${video?.codec_name} ${video?.width}x${video?.height} @ ${parseFloat(video?.r_frame_rate).toFixed(0)}fps`)
    console.log(`   Audio:      ${audio?.codec_name} ${audio?.sample_rate}Hz`)
    
    return { sizeMB, duration, width: video?.width, height: video?.height }
  } catch {
    console.log(`   Tamaño: ${sizeMB} MB`)
    return { sizeMB }
  }
}

// ── Paso 3: Procesar con FFmpeg ─────────────────────────────────────────────
function processVideo() {
  return new Promise((resolve, reject) => {
    console.log('\n🎬 Procesando video con FFmpeg...')
    console.log('   Aplicando filtros:')
    console.log('   • afftdn       → reducción de ruido/reverb con FFT')
    console.log('   • compand      → compresor dinámico (reduce colas de reverb)')
    console.log('   • highpass=80  → elimina rumble de baja frecuencia')
    console.log('   • H.264 CRF 26 → recodificación optimizada para web')
    console.log('   • faststart    → streaming progresivo (carga MUCHO más rápido)')
    console.log('   • audio 128k   → suficiente para voz, menos peso')
    console.log('')

    // Filtro de audio compuesto:
    // 1. afftdn: noise reduction basado en FFT (reduce reverb de fondo)
    // 2. compand: compresor que corta las colas largas de reverberación
    // 3. highpass: elimina frecuencias bajas que cargan el archivo
    const audioFilter = [
      'afftdn=nf=-25',                          // noise floor en -25dB
      'compand=attacks=0.1:decays=0.3:points=-80/-80|-45/-15|-27/-9|0/-7|20/-7',
      'highpass=f=80',
      'aresample=44100'
    ].join(',')

    const args = [
      '-i', LOCAL_INPUT,
      // — Video: recodificar H.264 optimizado para web
      '-c:v', 'libx264',
      '-crf', '26',                   // calidad (18=lossless, 28=pequeño, 26=balance)
      '-preset', 'slow',              // más tiempo de encode = mejor compresión
      '-profile:v', 'high',
      '-level', '4.0',
      '-pix_fmt', 'yuv420p',          // compatibilidad máxima (iOS, Android, etc)
      '-movflags', '+faststart',      // mueve metadata al inicio → empieza a reproducir de inmediato
      // — Audio: filtros de limpieza + recodificar
      '-c:a', 'aac',
      '-b:a', '128k',
      '-af', audioFilter,
      // — Output
      '-y',                           // sobreescribir sin preguntar
      LOCAL_OUTPUT
    ]

    console.log('   Ejecutando (puede tardar 2-5 minutos)...')
    
    const proc = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    
    let stderr = ''
    proc.stderr.on('data', (data) => {
      stderr += data.toString()
      // Mostrar progreso en tiempo real
      const match = stderr.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/)
      if (match) {
        process.stdout.write(`\r   Progreso: ${match[1]}`)
      }
    })

    proc.on('close', (code) => {
      if (code === 0) {
        const stats = statSync(LOCAL_OUTPUT)
        const sizeMB = (stats.size / 1024 / 1024).toFixed(1)
        console.log(`\n\n✅ Video procesado exitosamente`)
        console.log(`   Guardado en: ${LOCAL_OUTPUT}`)
        console.log(`   Tamaño nuevo: ${sizeMB} MB`)
        resolve(sizeMB)
      } else {
        console.error('\n\n❌ Error en FFmpeg')
        // Mostrar últimas líneas del error
        const lines = stderr.split('\n').slice(-20).join('\n')
        console.error(lines)
        reject(new Error(`FFmpeg salió con código ${code}`))
      }
    })
  })
}

// ── Paso 4: Subir a Supabase Storage ───────────────────────────────────────
async function uploadToSupabase() {
  console.log('\n📤 Subiendo video optimizado a Supabase Storage...')
  
  const buffer = readFileSync(LOCAL_OUTPUT)
  const sizeMB = (buffer.length / 1024 / 1024).toFixed(1)
  console.log(`   Tamaño: ${sizeMB} MB`)

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(REMOTE_PATH, buffer, {
      contentType: 'video/mp4',
      upsert: true,
      cacheControl: '31536000',
    })

  if (error) {
    console.error('❌ Error al subir:', error.message)
    throw error
  }

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(REMOTE_PATH).data.publicUrl
  console.log('✅ Subido exitosamente')
  console.log('   URL:', publicUrl)
  return publicUrl
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('  Optimizador de Video — Uintegrus Landing VSL ')
  console.log('═══════════════════════════════════════════════\n')

  checkFFmpeg()

  const { sizeMB: originalSize } = getVideoInfo()

  await processVideo()

  const outputStats = statSync(LOCAL_OUTPUT)
  const newSizeMB = (outputStats.size / 1024 / 1024).toFixed(1)
  const reduction = (((outputStats.size - statSync(LOCAL_INPUT).size) / statSync(LOCAL_INPUT).size) * 100).toFixed(0)

  console.log(`\n📊 Comparativa:`)
  console.log(`   Original:  ${originalSize} MB`)
  console.log(`   Optimizado: ${newSizeMB} MB  (${reduction}% cambio)`)

  await uploadToSupabase()

  // Limpiar archivo temporal
  if (existsSync(LOCAL_OUTPUT)) {
    unlinkSync(LOCAL_OUTPUT)
    console.log('🗑️  Archivo temporal eliminado')
  }

  console.log('\n🎉 ¡Todo listo! El video en producción ahora está optimizado.')
  console.log('   Abre uintegrus.com/auth/login para verlo.')
}

main().catch(console.error)
