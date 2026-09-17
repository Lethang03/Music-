import { storageProvider } from '../services/storage'
import { optimizeImageFile } from './imageOptimization'

export async function uploadMedia(file, path, onProgress) {
  if (!file) return null

  // Automatically compress cover and avatar images to high-efficiency WebP
  let uploadFileObj = file
  if (file.type?.startsWith('image/') || path?.includes('covers') || path?.includes('avatars')) {
    const isAvatar = path?.includes('avatars')
    uploadFileObj = await optimizeImageFile(file, {
      maxWidth: isAvatar ? 400 : 1000,
      maxHeight: isAvatar ? 400 : 1000,
      quality: 0.85
    })
  }

  const ext = uploadFileObj.name.split('.').pop()
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
    const { error } = await storageProvider.uploadFile('soundverse', fullPath, uploadFileObj, {
      contentType: uploadFileObj.type || undefined,
      cacheControl: '31536000, immutable',
      upsert: false
    })

    if (error) throw error

    if (onProgress) {
      clearInterval(interval)
      onProgress(100)
    }

    const { data: publicData } = storageProvider.getPublicUrl('soundverse', fullPath)
    return publicData.publicUrl
  } catch (err) {
    if (interval) clearInterval(interval)
    console.error('Upload Error:', err)
    throw new Error(`Upload failed: ${err.message}`)
  }
}
