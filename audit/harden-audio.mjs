import fs from 'node:fs'
const p='src/contexts/AudioContext.jsx';let s=fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')
s=s.replace("const initialPrefs = () => ({ volume: clampVolume(readStored('v2_volume', 1)), shuffle: false, repeat: 'none', autoplay: true, ...readStored('v2_playback_preferences', {}) })", `const initialPrefs = () => {
  const saved = readStored('v2_playback_preferences', {})
  return { volume: clampVolume(saved?.volume ?? readStored('v2_volume', 1)), shuffle: saved?.shuffle === true, repeat: ['none','one','all'].includes(saved?.repeat) ? saved.repeat : 'none', autoplay: saved?.autoplay !== false }
}`)
s=s.replace("  const model = useRef({ queue: [], index: 0, activeItem: null, isPlaying: false, currentTime: 0, duration: 0, error: '', ...initialPrefs() })\n  const [state, setState] = useState(model.current)", "  const [state, setState] = useState(() => ({ queue: [], index: 0, activeItem: null, isPlaying: false, currentTime: 0, duration: 0, error: '', ...initialPrefs() }))\n  const model = useRef(state)")
s=s.replace("    const item = model.current.queue[index]\n    if (!audio || !item) return", "    const item = model.current.queue[index]\n    if (!audio || !item) return\n    if (item._playNext) publish({ queue: model.current.queue.map((entry, i) => i === index ? { ...entry, _playNext: false } : entry) })")
s=s.replace("    let next = s.index + 1\n    if (s.shuffle", "    const priority = s.queue.findIndex((item, index) => index !== s.index && item._playNext)\n    let next = priority >= 0 ? priority : s.index + 1\n    if (priority < 0 && s.shuffle")
s=s.replace("saved.queue.filter(item => item && item.id && mediaUrl(item))", "saved.queue.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && mediaUrl(item)).slice(0, 1000)")
s=s.replace("queue.splice(next ? s.index + 1 : queue.length, 0, item)", "queue.splice(next ? s.index + 1 : queue.length, 0, next ? { ...item, _playNext: true } : item)")
fs.writeFileSync(p,s)
