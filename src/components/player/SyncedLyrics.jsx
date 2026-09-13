import React, { useEffect, useMemo, useRef } from 'react'
import './SyncedLyrics.css'

// Database JSON is deliberately validated at the UI boundary so a malformed
// lyric payload can never take down the Now Playing view.
export function parseSyncedLyrics(value) {
  const rows = typeof value === 'string' ? (() => { try { return JSON.parse(value) } catch { return [] } })() : value
  if (!Array.isArray(rows)) return []
  return rows
    .map(row => ({ start: Number(row?.start), end: Number(row?.end), text: typeof row?.text === 'string' ? row.text.trim() : '' }))
    .filter(row => Number.isFinite(row.start) && Number.isFinite(row.end) && row.start >= 0 && row.end > row.start && row.text)
    .sort((a, b) => a.start - b.start)
}

export default function SyncedLyrics({ lyrics, currentTime }) {
  const lines = useMemo(() => parseSyncedLyrics(lyrics), [lyrics])
  const lineRefs = useRef([])
  const activeIndex = lines.findIndex(line => currentTime >= line.start && currentTime < line.end)

  useEffect(() => {
    if (activeIndex >= 0) lineRefs.current[activeIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeIndex])

  if (!lines.length) return null
  return <div className="v2-synced-lyrics" aria-live="polite" aria-label="Synced lyrics">
    {lines.map((line, index) => <p
      key={`${line.start}-${index}`}
      ref={element => { lineRefs.current[index] = element }}
      className={`v2-synced-lyric ${index === activeIndex ? 'active' : ''} ${activeIndex >= 0 && index < activeIndex ? 'past' : ''}`}
    >{line.text}</p>)}
  </div>
}
