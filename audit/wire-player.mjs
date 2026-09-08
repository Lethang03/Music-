import fs from 'node:fs'
const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')))
edit('src/features/podcast/PodcastDetail.jsx',s=> {
 const start=s.indexOf('  const { podcasts } = useLibrary()'), end=s.indexOf('  const seasons =')
 s=s.slice(0,start)+`  const { podcasts, episodes: catalogEpisodes, loading, progress, error, loadPublicLibrary } = useLibrary()
  const { activeItem, isPlaying, playItem, togglePlay } = useAudio()
  const [selectedSeason, setSelectedSeason] = useState(null)
  useEffect(() => { setSelectedSeason(null) }, [id])
  const podcast = podcasts.find(p => p.id === id)
  const episodes = catalogEpisodes.filter(e => e.podcast_id === id).sort((a, b) => (a.season_number || 0) - (b.season_number || 0) || (a.episode_number || 0) - (b.episode_number || 0) || (a.published_at || '').localeCompare(b.published_at || ''))
  const loadingPod = loading, loadingEps = loading
  const errorPod = !loading && !podcast ? 'Podcast not found or unavailable.' : null
  const errorEps = error && !episodes.length ? error : null
  const fetchEpisodes = loadPublicLibrary

`+s.slice(end)
 s=s.replace('    playItem(episode, queue, episodeIndex)', "    if (activeItem?.id === episode.id && activeItem?.type === 'episode') { togglePlay(); return }\n    playItem(queue[episodeIndex], queue, episodeIndex)").replace('[displayedEpisodes, podcast, playItem]', '[displayedEpisodes, podcast, playItem, activeItem, togglePlay]').replace('progress={null}', 'progress={progress}').replace('{episodes.length > 0 && (', '{displayedEpisodes.length > 0 && (')
 return s
})
edit('src/components/player/GlobalPlayer.jsx',s=> {
 s=s.replace("import { useAudio }", "import TrackActions from '../TrackActions'\nimport { useLibrary } from '../../contexts/LibraryContext'\nimport { mediaKey } from '../../lib/storage'\nimport { useAudio }")
 s=s.replace('  const [activeTab, setActiveTab]', "  const { setCurrentIndex, removeFromQueue } = useAudio()\n  const { favorites, toggleFavorite } = useLibrary()\n  const liked = favorites.some(x => mediaKey(x) === mediaKey(activeItem))\n  const [activeTab, setActiveTab]")
 s=s.replace('const repeatIcon =', 'const RepeatIcon =').replace('<repeatIcon', '<RepeatIcon')
 s=s.replace('<button className="v2-icon-btn" title="More options">\n            <MoreHorizontal size={20} />\n          </button>', '<TrackActions item={activeItem} />')
 s=s.replace('<button className="v2-icon-btn" title="Like">', '<button className="v2-icon-btn" title={liked ? \'Remove favorite\' : \'Favorite\'} aria-pressed={liked} onClick={() => toggleFavorite(activeItem)}>')
 s=s.replace('                      >\n                        <img src={art}', '                      >\n                        <button aria-label={`Play ${item.title}`} onClick={() => setCurrentIndex(idx)}><Play size={16} /></button>\n                        <button aria-label={`Remove ${item.title} from queue`} onClick={() => removeFromQueue(idx)}><X size={16} /></button>\n                        <img src={art}')
 s=s.replace('No lyrics available', "{activeItem?.lyrics || 'No lyrics available for this item.'}")
 s=s.replace('z-index: 40;', 'z-index: 70;').replace('bottom: var(--mobile-nav-height);', 'bottom: calc(var(--mobile-nav-height) + var(--player-height));')
 // Restore mini-player location; only fullscreen must leave room for both.
 const mini=s.indexOf('export default function GlobalPlayer()')
 s=s.slice(0,mini)+s.slice(mini).replaceAll('bottom: calc(var(--mobile-nav-height) + var(--player-height));','bottom: var(--mobile-nav-height);')
 s=s.replace('    activeItem, isPlaying, togglePlay,\n    volume', '    activeItem, isPlaying, togglePlay, error,\n    volume')
 s=s.replace('  const [showNowPlaying, setShowNowPlaying]', "  const { favorites, toggleFavorite } = useLibrary()\n  const liked = favorites.some(x => mediaKey(x) === mediaKey(activeItem))\n  const [showNowPlaying, setShowNowPlaying]")
 s=s.replace('<button className="v2-icon-btn" title="Like" style={{ flexShrink: 0 }}>', '<button className="v2-icon-btn" title={liked ? \'Remove favorite\' : \'Favorite\'} aria-pressed={liked} onClick={() => toggleFavorite(activeItem)} style={{ flexShrink: 0 }}>')
 s=s.replace('<div className="v2-player-bar">', '<div className="v2-player-bar">\n        {error && <div role="alert" className="v2-player-error">{error}</div>}')
 s=s.replace('if (muted) {','if (volume === 0) {').replace("title={muted ? 'Unmute' : 'Mute'}", "title={volume === 0 ? 'Unmute' : 'Mute'}").replace('(muted || volume === 0)', '(volume === 0)').replace('value={muted ? 0 : volume}', 'value={volume}')
 s=s.replace('role="slider"', 'role="slider" tabIndex={0} aria-label="Playback position" onKeyDown={e => { if (e.key === \'ArrowRight\' || e.key === \'ArrowLeft\') { e.preventDefault(); seek(currentTime + (e.key === \'ArrowRight\' ? 5 : -5)) } }}')
 s=s.replace('className="v2-player-seek"', 'className="v2-player-seek" role="slider" tabIndex={0} aria-label="Playback position" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={currentTime} onKeyDown={e => { if (e.key === \'ArrowRight\' || e.key === \'ArrowLeft\') { e.preventDefault(); seek(currentTime + (e.key === \'ArrowRight\' ? 5 : -5)) } }}')
 return s
})
