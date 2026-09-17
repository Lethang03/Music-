import type { SupabaseClient } from '@supabase/supabase-js'
import type { StorageProvider } from './storageProvider'

// Keep this implementation in sync with the Node 22 runtime module beside it.
// The workers load the JavaScript module directly without a TypeScript loader.
export function createSupabaseStorageProvider(client: SupabaseClient): StorageProvider {
  return {
    uploadFile: (bucket, path, body, options) => client.storage.from(bucket).upload(path, body, options),
    downloadFile: (bucket, path) => client.storage.from(bucket).download(path),
    deleteFile: (bucket, paths) => client.storage.from(bucket).remove(paths),
    getPublicUrl: (bucket, path) => client.storage.from(bucket).getPublicUrl(path)
  }
}
