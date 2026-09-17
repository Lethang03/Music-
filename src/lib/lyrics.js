export function parseSyncedLyrics(value) {
  let rows = value
  if (typeof rows === 'string') { try { rows = JSON.parse(rows) } catch { return [] } }
  if (!Array.isArray(rows)) return []
  const number = value => (typeof value === 'number' || (typeof value === 'string' && value.trim())) ? Number(value) : NaN
  return rows.map(row => ({ start: number(row?.start), end: number(row?.end), text: typeof row?.text === 'string' ? row.text.trim() : '' }))
    .filter(row => Number.isFinite(row.start) && row.start >= 0 && Number.isFinite(row.end) && row.end > row.start && row.text).sort((a, b) => a.start - b.start)
}

export function parseLrc(value, duration = 0) {
  const entries = []
  const offset = Number(String(value).match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000
  for (const raw of String(value || '').split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):([0-5]\d)(?:\.(\d{1,3}))?\]/g)]
    const text = raw.replace(/\[[^\]]*\]/g, '').trim()
    if (!text) continue
    for (const stamp of stamps) {
      const start = Math.max(0, Number(stamp[1]) * 60 + Number(stamp[2]) + Number(`0.${stamp[3] || 0}`) + offset)
      if (Number.isFinite(start)) entries.push({ start, text })
    }
  }
  entries.sort((a, b) => a.start - b.start)
  const rows = entries.filter((row, i) => i === 0 || row.start !== entries[i - 1].start || row.text !== entries[i - 1].text)
  let nextStart = null
  const normalized = new Array(rows.length)
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i + 1] && rows[i + 1].start > rows[i].start) nextStart = rows[i + 1].start
    normalized[i] = { ...rows[i], end: nextStart ?? Math.max(Number.isFinite(Number(duration)) ? Number(duration) : 0, rows[i].start + 5) }
  }
  return normalized
}

export function activeLyricIndex(lines, time) {
  let low = 0; let high = lines.length - 1; let candidate = -1
  while (low <= high) { const mid = (low + high) >> 1; if (lines[mid].start <= time) { candidate = mid; low = mid + 1 } else high = mid - 1 }
  return candidate >= 0 && time < lines[candidate].end ? candidate : -1
}

export function lyricTimestamp(seconds) {
  const ticks = Math.round(seconds * 1000)
  return `${String(Math.floor(ticks / 60000)).padStart(2, '0')}:${(ticks % 60000 / 1000).toFixed(3).padStart(6, '0')}`
}

export function toLrc(value) { return parseSyncedLyrics(value).map(row => `[${lyricTimestamp(row.start)}]${row.text}`).join('\n') }
