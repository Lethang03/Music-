import fs from 'node:fs'
const p='src/features/podcast/PodcastDetail.jsx';let s=fs.readFileSync(p,'utf8'); const start=s.indexOf('  const seasons = [...new Set(data.map'); const end=s.indexOf('  const seasons = [...new Set(episodes.map',start); s=s.slice(0,start)+s.slice(end);fs.writeFileSync(p,s)
