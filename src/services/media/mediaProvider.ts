export interface MediaProvider {
  getAudioUrl(pathOrUrl: string): string
  getPodcastAudioUrl(pathOrUrl: string): string
  getCoverUrl(pathOrUrl: string): string
  getArtworkUrl(pathOrUrl: string): string
}
