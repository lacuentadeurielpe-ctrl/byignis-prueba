'use client'

import { useState, useRef } from 'react'
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface ProductImagesEditorProps {
  imagenes: string[]
  onChange: (imagenes: string[]) => void
}

export default function ProductImagesEditor({ imagenes, onChange }: ProductImagesEditorProps) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    const nuevasUrls: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size > 5 * 1024 * 1024) {
        alert(`El archivo ${file.name} es demasiado grande. Máximo 5MB.`)
        continue
      }
      
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
      const filePath = `catalogo/${fileName}`

      const { data, error } = await supabase.storage
        .from('productos-imagenes')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) {
        console.error('Error uploading image:', error)
        alert(`Error al subir ${file.name}: ${error.message}`)
      } else if (data) {
        const { data: publicData } = supabase.storage
          .from('productos-imagenes')
          .getPublicUrl(data.path)
        
        nuevasUrls.push(publicData.publicUrl)
      }
    }

    if (nuevasUrls.length > 0) {
      onChange([...imagenes, ...nuevasUrls])
    }
    
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemove = (index: number) => {
    onChange(imagenes.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <ImageIcon className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
        <div className="text-xs text-indigo-700 space-y-0.5">
          <p className="font-semibold">Imágenes del producto</p>
          <p>Sube imágenes para mostrar este producto en tu catálogo digital público.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {imagenes.map((url, i) => (
          <div key={i} className="relative aspect-square rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 group">
            <img src={url} alt={`Imagen ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => handleRemove(i)}
              className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-red-50 text-zinc-700 hover:text-red-600 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="aspect-square rounded-xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-zinc-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-all disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
          ) : (
            <Upload className="w-6 h-6 mb-2" />
          )}
          <span className="text-xs font-medium">{uploading ? 'Subiendo...' : 'Subir Imagen'}</span>
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/webp"
        multiple
        className="hidden"
      />
    </div>
  )
}
