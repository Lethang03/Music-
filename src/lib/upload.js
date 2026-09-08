import { supabase } from './supabase'

export async function uploadMedia(file, path, onProgress) {
  if (!file) return null
  
  const ext = file.name.split('.').pop()
  const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`
  const fullPath = path ? `${path}/${uniqueName}` : uniqueName

  let progress = 0
  let interval
  if (onProgress) {
    onProgress(0)
    interval = setInterval(() => {
      progress += (90 - progress) * 0.1
      if (progress > 90) progress = 90
      onProgress(Math.round(progress))
    }, 200)
  }

  try {
    const { data, error } = await supabase.storage
      .from('soundverse')
      .upload(fullPath, file, { cacheControl: '3600', upsert: false })

    if (error) throw error

    if (onProgress) {
      clearInterval(interval)
      onProgress(100)
    }

    const { data: publicData } = supabase.storage.from('soundverse').getPublicUrl(fullPath)
    return publicData.publicUrl
  } catch (err) {
    if (interval) clearInterval(interval)
    console.error('Upload Error:', err)
    throw new Error(`Upload failed: ${err.message}`)
  }
}

