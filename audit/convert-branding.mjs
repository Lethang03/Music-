import { execSync } from 'child_process'
import ffmpegPath from 'ffmpeg-static'

console.log('Converting branding assets to WebP...')
execSync(`"${ffmpegPath}" -y -i public/branding/soundverse-logo.png -c:v libwebp -quality 90 public/branding/soundverse-logo.webp`, { stdio: 'inherit' })
execSync(`"${ffmpegPath}" -y -i public/branding/soundverse-icon-master.png -c:v libwebp -quality 90 public/branding/soundverse-icon-master.webp`, { stdio: 'inherit' })
console.log('Finished converting.')

