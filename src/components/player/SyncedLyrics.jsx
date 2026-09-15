import React, { useEffect, useMemo, useRef, useState } from 'react'
import { parseSyncedLyrics, activeLyricIndex } from '../../lib/lyrics'
import './SyncedLyrics.css'

// Database JSON is deliberately validated at the UI boundary so a malformed
// lyric payload can never take down the Now Playing view.
export { parseSyncedLyrics } from '../../lib/lyrics'

export default function SyncedLyrics({ lyrics, currentTime, seek }) {
  const lines = useMemo(() => parseSyncedLyrics(lyrics), [lyrics])
  const lineRefs = useRef([])
  const container = useRef(null)
  const timer = useRef(null)
  const [following, setFollowing] = useState(true)
  const activeIndex = activeLyricIndex(lines, currentTime)
  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (following && activeIndex >= 0 && container.current) {
      const parent = container.current; const line = lineRefs.current[activeIndex]
      if (line) parent.scrollTo({ top: line.offsetTop - parent.offsetTop - parent.clientHeight * .4, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
  }, [activeIndex, following])
  const pauseFollow = () => { setFollowing(false); clearTimeout(timer.current); timer.current = setTimeout(() => setFollowing(true), 5000) }

  if (!lines.length) return null
  return <div className="lyrics-follow-panel">
    <button className="lyrics-follow" aria-pressed={following} onClick={() => { clearTimeout(timer.current); setFollowing(true) }}>{following ? 'Following lyrics' : 'Follow Lyrics'}</button>
    <div ref={container} className="v2-synced-lyrics" aria-label="Synced lyrics" tabIndex={0} onWheel={pauseFollow} onTouchMove={pauseFollow} onPointerDown={pauseFollow} onKeyDown={e => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) pauseFollow() }}>
    {lines.map((line, index) => <button
      key={`${line.start}-${index}`}
      ref={element => { lineRefs.current[index] = element }}
      className={`v2-synced-lyric ${index === activeIndex ? 'active' : ''} ${currentTime >= line.end ? 'past' : ''}`}
      aria-current={index === activeIndex ? 'true' : undefined}
      aria-label={`Seek to ${line.start} seconds: ${line.text}`}
      disabled={!seek}
      onClick={() => seek?.(line.start)}
    >{line.text}</button>)}
    </div>
  </div>
}
