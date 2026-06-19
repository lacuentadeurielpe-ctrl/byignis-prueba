// Google Drive API helper — sube archivos a la carpeta FerroBot del tenant.
// Usa el scope drive.file, lo que significa que solo accede a archivos creados por esta app.

export interface DriveUploadResult {
  ok:       boolean
  fileId?:  string
  webLink?: string
  error?:   string
}

/**
 * Sube un buffer (PDF, CSV, etc.) a Google Drive.
 * Si folderId es undefined, lo sube a la raíz de My Drive.
 */
export async function subirArchivoaDrive(opts: {
  accessToken: string
  nombre:      string
  mimeType:    string
  contenido:   string | ArrayBuffer
  folderId?:   string
}): Promise<DriveUploadResult> {
  const metadata: Record<string, unknown> = {
    name:     opts.nombre,
    mimeType: opts.mimeType,
  }
  if (opts.folderId) {
    metadata.parents = [opts.folderId]
  }

  const form = new FormData()
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
  )
  form.append('file', new Blob([opts.contenido], { type: opts.mimeType }))

  try {
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${opts.accessToken}` },
        body:    form,
        signal:  AbortSignal.timeout(30_000),
      },
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, error: (err as any)?.error?.message ?? `Drive error ${res.status}` }
    }

    const data = await res.json()
    return { ok: true, fileId: data.id, webLink: data.webViewLink }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al subir archivo a Drive' }
  }
}

/**
 * Crea la carpeta "FerroBot" en Drive si no existe y devuelve su ID.
 * Si ya existe la devuelve directamente (query por nombre).
 */
export async function obtenerOCrearCarpetaFerroBot(accessToken: string): Promise<string | null> {
  const query = `name='FerroBot' and mimeType='application/vnd.google-apps.folder' and trashed=false`

  try {
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal:  AbortSignal.timeout(10_000),
      },
    )

    if (searchRes.ok) {
      const data = await searchRes.json()
      const existing = (data.files ?? [])[0]
      if (existing) return existing.id
    }

    // Crear la carpeta
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name:     'FerroBot',
        mimeType: 'application/vnd.google-apps.folder',
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!createRes.ok) return null
    const newFolder = await createRes.json()
    return newFolder.id ?? null
  } catch {
    return null
  }
}
