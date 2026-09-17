// Edge Runtime adapter for the same storage operations used by the browser and
// Node workers. Keep this module free of Node APIs and environment access.
export function createSupabaseStorageProvider(client: any) {
  return {
    uploadFile: (bucket: string, path: string, body: Blob, options?: { contentType?: string; cacheControl?: string; upsert?: boolean }) =>
      client.storage.from(bucket).upload(path, body, { cacheControl: '31536000, immutable', ...options }),
    downloadFile: (bucket: string, path: string) =>
      client.storage.from(bucket).download(path),
    deleteFile: (bucket: string, paths: string[]) =>
      client.storage.from(bucket).remove(paths),
    getPublicUrl: (bucket: string, path: string) =>
      client.storage.from(bucket).getPublicUrl(path)
  }
}

export type EdgeStorageProvider = ReturnType<typeof createSupabaseStorageProvider>
