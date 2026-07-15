import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://copncsicoevhliaoxfpj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcG5jc2ljb2V2aGxpYW94ZnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDU2MzQsImV4cCI6MjA5NjAyMTYzNH0.YCPa6frtS0BWyqnrV4DK6Xcvl4Es_EpRk7bgIB2zeIA'
)

async function getDir() {
  const { data, error } = await supabase.from('ferreterias').select('id, nombre, direccion')
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Ferreterias:', data)
  }
}

getDir()
