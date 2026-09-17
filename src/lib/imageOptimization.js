/**
 * Client-side image optimization utility.
 * Resizes large cover/avatar images and converts them to modern WebP format
 * before uploading to Supabase Storage, dramatically reducing storage usage
 * and bandwidth egress without visible quality loss.
 */

export async function optimizeImageFile(file, options = {}) {
  // If not a valid file or not in a browser environment with canvas, return original
  if (!file || !(file instanceof Blob) || typeof window === 'undefined') {
    return file
  }

  // Only optimize raster images; leave SVGs and audio/video untouched
  if (!file.type || !file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file
  }

  const {
    maxWidth = 1000,
    maxHeight = 1000,
    quality = 0.85,
    mimeType = 'image/webp'
  } = options

  try {
    const bitmap = await createImageBitmap(file).catch(async () => {
      // Fallback for browsers / environments where createImageBitmap fails on certain formats
      return new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
          URL.revokeObjectURL(url)
          resolve(img)
        }
        img.onerror = (err) => {
          URL.revokeObjectURL(url)
          reject(err)
        }
        img.src = url
      })
    })

    let width = bitmap.width || bitmap.naturalWidth || 0
    let height = bitmap.height || bitmap.naturalHeight || 0

    if (!width || !height) {
      if (typeof bitmap.close === 'function') bitmap.close()
      return file
    }

    // Calculate dimensions preserving aspect ratio
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height)
      width = Math.max(1, Math.round(width * ratio))
      height = Math.max(1, Math.round(height * ratio))
    }

    // Render to canvas
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { alpha: true })

    if (!ctx) {
      if (typeof bitmap.close === 'function') bitmap.close()
      return file
    }

    // High quality scaling
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)

    if (typeof bitmap.close === 'function') bitmap.close()

    // Export as WebP blob
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), mimeType, quality)
    })

    if (!blob) {
      return file
    }

    // Only use the converted WebP if it's smaller or if the original was an uncompressed format (PNG/BMP/TIFF)
    const isUncompressed = /image\/(png|bmp|tiff)/i.test(file.type)
    if (blob.size >= file.size && !isUncompressed) {
      return file
    }

    const baseName = (file.name || 'image').replace(/\.[^.]+$/, '')
    const newName = `${baseName}.webp`

    return new File([blob], newName, {
      type: mimeType,
      lastModified: Date.now()
    })
  } catch (error) {
    console.warn('Image optimization skipped or failed, using original file:', error)
    return file
  }
}

