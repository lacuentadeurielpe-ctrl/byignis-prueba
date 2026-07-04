'use client'

import React, { useState, useRef } from 'react'
import { UploadCloud, X, Loader2, Image as ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface ImageUploaderProps {
  value: string
  onChange: (url: string) => void
  bucket?: string
  pathPrefix?: string
  className?: string
}

export default function ImageUploader({ 
  value, 
  onChange, 
  bucket = 'logos', 
  pathPrefix = 'ferreteria',
  className 
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await uploadFile(file)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadFile(file)
  }

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Por favor sube una imagen válida (PNG, JPG, etc)')
      return
    }

    try {
      setIsUploading(true)
      setError(null)

      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const fileName = `${pathPrefix}_${Date.now()}.${ext}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath)

      onChange(publicUrlData.publicUrl)
    } catch (err: any) {
      console.error('Error uploading image', err)
      setError(err.message || 'Error al subir la imagen')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className={cn('w-full', className)}>
      {value ? (
        <div className="relative rounded-xl border border-zinc-200 p-2 group bg-zinc-50 flex justify-center items-center overflow-hidden aspect-video">
          <img src={value} alt="Preview" className="max-w-full max-h-full object-contain z-10" />
          
          {/* Fondo borroso decorativo */}
          <div className="absolute inset-0 opacity-30 z-0">
             <img src={value} alt="Blur" className="w-full h-full object-cover blur-md" />
          </div>

          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20">
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-2 bg-white text-red-500 rounded-full hover:bg-red-50 transition shadow-sm"
              title="Eliminar imagen"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 bg-white text-zinc-700 rounded-full hover:bg-zinc-100 transition shadow-sm"
              title="Cambiar imagen"
            >
              <UploadCloud className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors text-center',
            isDragging ? 'border-zinc-500 bg-zinc-100' : 'border-zinc-200 hover:bg-zinc-50',
            isUploading && 'opacity-50 pointer-events-none'
          )}
        >
          {isUploading ? (
            <Loader2 className="w-8 h-8 text-zinc-400 animate-spin mb-3" />
          ) : (
            <ImageIcon className="w-8 h-8 text-zinc-300 mb-3" />
          )}
          
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-700">
              {isUploading ? 'Subiendo imagen...' : 'Arrastra una imagen o haz clic'}
            </p>
            <p className="text-xs text-zinc-400">
              PNG, JPG o WEBP hasta 2MB
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-500 font-medium">{error}</p>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      
      {/* Campo de texto alternativo por si la subida falla o quieren poner url directa */}
      {!value && !isUploading && (
        <div className="mt-3">
          <label className="text-xs text-zinc-500 block mb-1">O ingresa URL directamente:</label>
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300 transition"
          />
        </div>
      )}
    </div>
  )
}
