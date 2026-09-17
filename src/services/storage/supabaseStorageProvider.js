// Keep the SDK response shapes so existing upload and import error handling stays intact.
export function createSupabaseStorageProvider(client) {
  return {
    uploadFile: (bucket, path, body, options) => client.storage.from(bucket).upload(path, body, options),
    downloadFile: (bucket, path) => client.storage.from(bucket).download(path),
    deleteFile: (bucket, paths) => client.storage.from(bucket).remove(paths),
    getPublicUrl: (bucket, path) => client.storage.from(bucket).getPublicUrl(path)
  }
}
