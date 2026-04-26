const EVENTOS_BUCKET = 'eventos'

export async function subirImagenEvento(supabase, file, userId) {
  if (!file) return null

  if (!file.type?.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen')
  }

  const extension = file.name.split('.').pop() || 'jpg'
  const nombre = `${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage
    .from(EVENTOS_BUCKET)
    .upload(nombre, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    })

  if (error) {
    const mensaje = `${error.message || ''} ${error.name || ''}`.toLowerCase()
    if (mensaje.includes('bucket') && mensaje.includes('not found')) {
      throw new Error('No existe el bucket "eventos" en Supabase Storage. Crealo como bucket publico y vuelve a intentarlo.')
    }
    throw error
  }

  const { data } = supabase.storage.from(EVENTOS_BUCKET).getPublicUrl(nombre)
  return data.publicUrl
}
