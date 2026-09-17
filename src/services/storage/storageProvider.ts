export interface StorageProvider {
  uploadFile(bucket: string, path: string, body: Blob | File | ArrayBuffer | Uint8Array, options?: Record<string, unknown>): Promise<{ data: unknown; error: Error | null }>
  downloadFile(bucket: string, path: string): Promise<{ data: Blob | null; error: Error | null }>
  deleteFile(bucket: string, paths: string[]): Promise<{ data: unknown; error: Error | null }>
  getPublicUrl(bucket: string, path: string): { data: { publicUrl: string }; error: Error | null }
}
