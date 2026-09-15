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

export function splitLyricsToLines(value) {
  if (Array.isArray(value)) {
    return value.map(line => typeof line === 'string' ? line.trim() : typeof line?.text === 'string' ? line.text.trim() : '').filter(Boolean)
  }
  return String(value || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
}

export function validateAndAlignTimestamps(canonicalSource, rawTimestamps = [], { trackDuration = null, defaultLineDuration = 4 } = {}) {
  const canonicalLines = splitLyricsToLines(canonicalSource)
  if (!canonicalLines.length) return []

  const rawList = Array.isArray(rawTimestamps) ? rawTimestamps : []
  const aligned = []
  let lastStart = 0

  const maxValidDuration = Number.isFinite(Number(trackDuration)) && Number(trackDuration) > 0 ? Number(trackDuration) : null

  for (let i = 0; i < canonicalLines.length; i++) {
    const canonicalText = canonicalLines[i]
    // Match by line_index or by array index
    const rawMatch = rawList.find(r => r?.line_index === i) || rawList[i] || null

    let rawStart = Number(rawMatch?.start)
    let rawEnd = Number(rawMatch?.end)
    let conf = Number(rawMatch?.confidence)
    if (!Number.isFinite(conf) || conf < 0 || conf > 1) {
      conf = rawMatch ? 0.75 : 0.2
    }

    let isSuspicious = false

    // Validate start
    let start = Number.isFinite(rawStart) ? Math.max(0, rawStart) : null
    if (start === null) {
      start = lastStart > 0 ? lastStart + defaultLineDuration : 0
      conf = Math.min(conf, 0.4)
      isSuspicious = true
    }

    // Monotonicity check: start must be >= lastStart
    if (start < lastStart) {
      start = lastStart + 0.1
      conf = Math.min(conf, 0.5)
      isSuspicious = true
    }

    // Upper bound sanity check
    if (maxValidDuration && start > maxValidDuration + 5) {
      conf = Math.min(conf, 0.3)
      isSuspicious = true
    }

    // Look ahead to see if next item has a valid start
    const nextMatch = rawList.find(r => r?.line_index === i + 1) || rawList[i + 1] || null
    const nextRawStart = Number(nextMatch?.start)
    const validNextStart = Number.isFinite(nextRawStart) && nextRawStart > start ? nextRawStart : null

    // Validate end: must be > start
    let end = Number.isFinite(rawEnd) && rawEnd > start ? rawEnd : null
    if (end === null) {
      if (validNextStart) {
        end = validNextStart
      } else if (i === canonicalLines.length - 1 && maxValidDuration && maxValidDuration > start) {
        end = maxValidDuration
      } else {
        end = start + defaultLineDuration
      }
    }

    // Ensure end is strictly greater than start
    if (end <= start) {
      end = start + 0.5
      conf = Math.min(conf, 0.5)
      isSuspicious = true
    }

    // Check line duration anomalies
    const lineSpan = end - start
    if (lineSpan < 0.3 || lineSpan > 35) {
      conf = Math.min(conf, 0.55)
      isSuspicious = true
    }

    if (conf < 0.60) {
      isSuspicious = true
    }

    let confidenceLevel = 'high'
    if (conf < 0.60) {
      confidenceLevel = 'low'
    } else if (conf < 0.85) {
      confidenceLevel = 'medium'
    }

    aligned.push({
      line_index: i,
      start: Math.round(start * 100) / 100,
      end: Math.round(end * 100) / 100,
      text: canonicalText, // Strictly canonical!
      confidence: Math.round(conf * 100) / 100,
      confidenceLevel,
      isSuspicious
    })

    lastStart = start
  }

  // Backwards pass to resolve any overlaps: if aligned[i].end > aligned[i+1].start, clamp end
  for (let i = 0; i < aligned.length - 1; i++) {
    if (aligned[i].end > aligned[i + 1].start) {
      aligned[i].end = Math.max(aligned[i].start + 0.2, aligned[i + 1].start)
      aligned[i].end = Math.round(aligned[i].end * 100) / 100
    }
  }

  return aligned
}

export function calculateSyncQuality(canonicalSource, alignedLines = [], { trackDuration = null, sourceDuration = null } = {}) {
  const canonicalLines = splitLyricsToLines(canonicalSource)
  const originalLines = canonicalLines.length
  const alignedCount = Array.isArray(alignedLines) ? alignedLines.length : 0
  const unmatchedLines = Math.max(0, originalLines - alignedCount)

  const lowConfidenceLines = alignedLines.filter(l => l?.confidenceLevel === 'low').length
  const mediumConfidenceLines = alignedLines.filter(l => l?.confidenceLevel === 'medium').length
  const highConfidenceLines = alignedLines.filter(l => l?.confidenceLevel === 'high').length

  const sumConf = alignedLines.reduce((acc, l) => acc + (Number(l?.confidence) || 0), 0)
  const averageConfidence = alignedCount > 0 ? Math.round((sumConf / alignedCount) * 100) / 100 : 0

  const trackDur = Number(trackDuration) || 0
  const sourceDur = Number(sourceDuration) || 0
  const durationDifference = (trackDur > 0 && sourceDur > 0) ? Math.abs(Math.round((trackDur - sourceDur) * 100) / 100) : 0
  const durationMismatch = trackDur > 0 && sourceDur > 0 && durationDifference > 5

  let status = 'success'
  if (alignedCount === 0 || unmatchedLines > originalLines * 0.4) {
    status = 'failed'
  } else if (durationMismatch || lowConfidenceLines > 0 || unmatchedLines > 0 || averageConfidence < 0.75) {
    status = 'needs_review'
  }

  return {
    originalLines,
    alignedLines: alignedCount,
    unmatchedLines,
    lowConfidenceLines,
    mediumConfidenceLines,
    highConfidenceLines,
    averageConfidence,
    trackDuration: trackDur,
    sourceDuration: sourceDur,
    durationDifference,
    durationMismatch,
    status
  }
}

