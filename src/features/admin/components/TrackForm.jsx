import React, { useState, useRef, useEffect } from 'react'
import { Upload, Link as LinkIcon, Image as ImageIcon, Music, Play, Pause, ChevronDown, ChevronUp, Sparkles, CheckCircle2, AlertTriangle, XCircle, Loader2, RotateCcw, Edit3 } from 'lucide-react'
import './TrackForm.css'
import { parseLrc, parseSyncedLyrics, toLrc, lyricTimestamp, activeLyricIndex, validateAndAlignTimestamps } from '../../../lib/lyrics'
import { discoverTrackSource, alignTrackLyricsWithGemini, validateYouTubeUrl } from '../../../lib/geminiLyricsSync'

export default function TrackForm({ initialData, onSave, onCancel, busy }) {
  const isEdit = !!initialData?.id

  const [form, setForm] = useState({
    title: initialData?.title || '',
    artist: initialData?.artist || '',
    album: initialData?.album || '',
    genre: initialData?.genre || '',
    release_date: initialData?.release_date || '',
    track_number: initialData?.track_number || '',
    duration: initialData?.duration || '',
    explicit_content: initialData?.explicit_content || false,
    description: initialData?.description || '',
    lyrics: initialData?.lyrics || '',
    lyrics_type: initialData?.lyrics_type || 'plain',
    synced_lyrics: initialData?.synced_lyrics ? JSON.stringify(initialData.synced_lyrics, null, 2) : '',
    source_url: initialData?.source_url || '',
    lyrics_sync_source_url: initialData?.lyrics_sync_source_url || '',
    lyrics_sync_confidence: initialData?.lyrics_sync_confidence || null,
    lyrics_synced_at: initialData?.lyrics_synced_at || null,
    published: initialData?.published || false,
    cover_url: initialData?.cover_url || '',
    audio_url: initialData?.audio_url || ''
  })

  const [artworkMode, setArtworkMode] = useState('upload') // 'upload' | 'url'
  const [audioMode, setAudioMode] = useState('url') // 'upload' | 'url'

  const [coverFile, setCoverFile] = useState(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(initialData?.cover_url || '')
  
  const [audioFile, setAudioFile] = useState(null)
  
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [lrc, setLrc] = useState(() => toLrc(initialData?.synced_lyrics))
  const [lyricNotice, setLyricNotice] = useState('')
  const [audioPreviewPlaying, setAudioPreviewPlaying] = useState(false)
  
  const [sourceUrl, setSourceUrl] = useState(initialData?.lyrics_sync_source_url || initialData?.source_url || '')
  const [sourceDetected, setSourceDetected] = useState(false)
  const [sourceWarning, setSourceWarning] = useState('')
  const [syncStatus, setSyncStatus] = useState('idle') // 'idle' | 'analyzing' | 'completed' | 'failed'
  const [syncStep, setSyncStep] = useState(0)
  const [syncProgressMsg, setSyncProgressMsg] = useState('')
  const [syncError, setSyncError] = useState('')
  const [alignedPreview, setAlignedPreview] = useState(null)
  const [syncQuality, setSyncQuality] = useState(null)
  const [previewTime, setPreviewTime] = useState(0)
  const [showLrcEditor, setShowLrcEditor] = useState(false)
  const [showAutoSyncSection, setShowAutoSyncSection] = useState(true)

  const audioRef = useRef(null)
  const fileInputRef = useRef(null)
  const audioInputRef = useRef(null)

  // Validate Audio Mode initially
  useEffect(() => {
    if (isEdit && initialData?.cover_url && !initialData.cover_url.startsWith('http')) setArtworkMode('url')
    if (isEdit && initialData?.audio_url && !initialData.audio_url.startsWith('http')) setAudioMode('url') // Just heuristic
  }, [isEdit, initialData])

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [])

  const handleArtworkChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert("Invalid image format. Please use JPG, PNG, or WEBP.")
      return
    }
    setCoverFile(file)
    const objectUrl = URL.createObjectURL(file)
    setCoverPreviewUrl(objectUrl)
  }

  const handleAudioChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAudioFile(file)
    
    // Auto detect duration
    const objectUrl = URL.createObjectURL(file)
    const tempAudio = new Audio(objectUrl)
    tempAudio.addEventListener('loadedmetadata', () => {
      setForm(prev => ({ ...prev, duration: Math.round(tempAudio.duration) }))
    })
  }

  // Auto-discover YouTube source for existing tracks if available
  useEffect(() => {
    if (isEdit && initialData) {
      discoverTrackSource(initialData).then(discovered => {
        if (discovered?.source_url) {
          setSourceUrl(prev => prev || discovered.source_url)
          setSourceDetected(true)
        }
      }).catch(err => console.warn('Source discovery error:', err))
    }
  }, [isEdit, initialData])

  const toggleAudioPreview = (seekTo) => {
    if (!audioRef.current) return

    if (typeof seekTo === 'number' && Number.isFinite(seekTo)) {
      const src = audioMode === 'upload' && audioFile 
        ? URL.createObjectURL(audioFile) 
        : form.audio_url

      if (!src) return

      if (audioRef.current.src !== src) {
        audioRef.current.src = src
      }

      audioRef.current.currentTime = seekTo
      setPreviewTime(seekTo)
      if (!audioPreviewPlaying) {
        audioRef.current.play().then(() => setAudioPreviewPlaying(true)).catch(e => console.error(e))
      }
      return
    }
    
    if (audioPreviewPlaying) {
      audioRef.current.pause()
      setAudioPreviewPlaying(false)
    } else {
      const src = audioMode === 'upload' && audioFile 
        ? URL.createObjectURL(audioFile) 
        : form.audio_url

      if (!src) return

      if (audioRef.current.src !== src) {
        audioRef.current.src = src
      }
      
      audioRef.current.play().then(() => setAudioPreviewPlaying(true)).catch(e => console.error(e))
    }
  }

  const handleStartAutoSync = async () => {
    if (!form.lyrics || !form.lyrics.trim()) {
      alert('Lyrics required before sync. Please enter plain lyrics first.')
      return
    }
    if (!sourceUrl.trim()) {
      alert('A YouTube source URL is required.')
      return
    }

    try {
      validateYouTubeUrl(sourceUrl)
    } catch (err) {
      alert(err.message)
      return
    }

    setSyncStatus('analyzing')
    setSyncError('')
    setSyncStep(1)
    setSyncProgressMsg(`Source detected: ${sourceUrl}`)

    try {
      const result = await alignTrackLyricsWithGemini({
        track: {
          ...form,
          id: initialData?.id || 'temp-id',
        },
        sourceUrl: sourceUrl.trim(),
        onProgress: (p) => {
          setSyncStep(p.step)
          setSyncProgressMsg(`${p.label}${p.detail ? ` (${p.detail})` : ''}`)
        }
      })

      setAlignedPreview(result.synced_lyrics)
      setSyncQuality(result.quality)
      setSyncStep(4)
      setSyncStatus('completed')

      if (result.quality?.durationMismatch) {
        setSourceWarning(`Source duration (${result.quality.sourceDuration}s) differs from track duration (${result.quality.trackDuration}s). Source may be a different song version.`)
      } else {
        setSourceWarning('')
      }
    } catch (err) {
      setSyncStatus('failed')
      setSyncError(err.message || 'Lyrics synchronization failed.')
    }
  }

  const handleApplySyncedLyrics = () => {
    if (!alignedPreview || !alignedPreview.length) return
    const rows = alignedPreview.map(({ start, end, text }) => ({ start, end, text }))
    const lrcString = toLrc(rows)
    setForm(prev => ({
      ...prev,
      lyrics_type: 'synced',
      synced_lyrics: JSON.stringify(rows, null, 2),
      source_url: sourceUrl || prev.source_url,
      lyrics_sync_source_url: sourceUrl,
      lyrics_sync_confidence: syncQuality?.averageConfidence ?? null,
      lyrics_synced_at: new Date().toISOString()
    }))
    setLrc(lrcString)
    setLyricNotice(`${rows.length} lines synced from YouTube reference. Original plain lyrics preserved intact.`)
    setSyncStatus('idle')
    setSyncStep(0)
  }

  const handleDrop = (e, setter, validator) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (validator && !validator(file)) return
    setter({ target: { files: [file] } })
  }

  const submit = (e, forcePublished) => {
    if (e) e.preventDefault()
    
    // Validation
    if (!form.title.trim()) return alert("Title is required")
    if (audioMode === 'url' && !form.audio_url.trim() && !initialData?.audio_url) return alert("Audio URL is required")
    if (audioMode === 'upload' && !audioFile && !initialData?.audio_url) return alert("Audio File is required")

    let syncedLyrics = null
    if (form.lyrics_type === 'synced') {
      try {
        const rows = JSON.parse(form.synced_lyrics)
        syncedLyrics = parseSyncedLyrics(rows)
        if (!syncedLyrics.length || syncedLyrics.length !== rows.length) throw new Error()
      } catch { return alert('Parse or enter valid synced lyrics before saving.') }
    }

    const finalPublished = forcePublished !== undefined ? forcePublished : form.published;

    onSave({
      ...form,
      published: finalPublished,
      newCoverFile: artworkMode === 'upload' ? coverFile : null,
      newAudioFile: audioMode === 'upload' ? audioFile : null,
      synced_lyrics: syncedLyrics,
      source_url: form.source_url || sourceUrl || null,
      lyrics_sync_source_url: form.lyrics_sync_source_url || sourceUrl || null,
      lyrics_sync_confidence: form.lyrics_sync_confidence,
      lyrics_synced_at: form.lyrics_synced_at
    })
  }

  const formatSize = (bytes) => (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  const formatTime = (secs) => {
    if (!secs) return '00:00'
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = Math.floor(secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div className="v2-track-form-container">
      <div className="v2-track-form-header">
        <button type="button" className="v2-btn-back" onClick={onCancel} disabled={busy}>← Back</button>
        <div>
          <h2>{isEdit ? 'Edit Track' : 'Add New Track'}</h2>
          <p>{isEdit ? 'Update track metadata and files' : 'Create a new music release'}</p>
        </div>
      </div>

      <form onSubmit={submit} className="v2-track-form">
        
        {/* ROW 1: Artwork and Basic Info */}
        <div className="v2-form-split-row">
          
          {/* ARTWORK SECTION */}
          <div className="v2-form-section artwork-section">
            <h3>Artwork</h3>
            
            <div className="v2-segmented-control">
              <button type="button" className={artworkMode === 'upload' ? 'active' : ''} onClick={() => setArtworkMode('upload')}>Upload</button>
              <button type="button" className={artworkMode === 'url' ? 'active' : ''} onClick={() => setArtworkMode('url')}>URL</button>
            </div>

            {artworkMode === 'upload' ? (
              <div 
                className="v2-artwork-dropzone"
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, handleArtworkChange, f => f.type.startsWith('image/'))}
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" accept="image/jpeg, image/png, image/webp" ref={fileInputRef} onChange={handleArtworkChange} hidden />
                {coverPreviewUrl ? (
                  <div className="v2-artwork-preview">
                    <img src={coverPreviewUrl} alt="Preview" />
                    <div className="v2-artwork-overlay">Change image</div>
                  </div>
                ) : (
                  <div className="v2-artwork-empty">
                    <ImageIcon size={32} />
                    <span>Drag & Drop</span>
                    <small>or Browse files</small>
                  </div>
                )}
              </div>
            ) : (
              <div className="v2-form-group">
                <label>Image URL</label>
                <input type="url" value={form.cover_url} onChange={e => {
                  setForm({...form, cover_url: e.target.value})
                  setCoverPreviewUrl(e.target.value)
                }} placeholder="https://..." disabled={busy} />
                {coverPreviewUrl && <img src={coverPreviewUrl} alt="Preview" className="v2-url-preview-thumb" />}
              </div>
            )}
          </div>

          {/* BASIC INFO SECTION */}
          <div className="v2-form-section flex-1">
            <h3>Basic Information</h3>
            <div className="v2-form-group">
              <label>Title *</label>
              <input aria-label="title" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} disabled={busy} placeholder="Song title" />
            </div>
            
            <div className="v2-form-group">
              <label>Artist *</label>
              <input required value={form.artist} onChange={e => setForm({...form, artist: e.target.value})} disabled={busy} placeholder="Primary artist" />
            </div>

            <div className="v2-form-row-2">
              <div className="v2-form-group">
                <label>Album</label>
                <input value={form.album} onChange={e => setForm({...form, album: e.target.value})} disabled={busy} placeholder="Album name" />
              </div>
              <div className="v2-form-group">
                <label>Genre</label>
                <select value={form.genre} onChange={e => setForm({...form, genre: e.target.value})} disabled={busy}>
                  <option value="">Select genre...</option>
                  <option value="Pop">Pop</option>
                  <option value="Ballad">Ballad</option>
                  <option value="Rap">Rap</option>
                  <option value="R&B">R&B</option>
                  <option value="Rock">Rock</option>
                  <option value="Indie">Indie</option>
                  <option value="Electronic">Electronic</option>
                  <option value="Lo-fi">Lo-fi</option>
                  <option value="Acoustic">Acoustic</option>
                  <option value="Instrumental">Instrumental</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* AUDIO FILE SECTION */}
        <div className="v2-form-section">
          <h3>Audio File</h3>
          
          <div className="v2-segmented-control small">
            <button type="button" className={audioMode === 'upload' ? 'active' : ''} onClick={() => setAudioMode('upload')}>Upload File</button>
            <button type="button" className={audioMode === 'url' ? 'active' : ''} onClick={() => setAudioMode('url')}>Audio URL</button>
          </div>

          {audioMode === 'upload' ? (
            <div 
              className={`v2-audio-dropzone ${audioFile ? 'has-file' : ''}`}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, handleAudioChange, f => f.type.startsWith('audio/'))}
            >
              <input type="file" accept="audio/*" ref={audioInputRef} onChange={handleAudioChange} hidden />
              {!audioFile ? (
                <div className="v2-audio-empty" onClick={() => audioInputRef.current?.click()}>
                  <Music size={24} />
                  <span>Drop your audio file here</span>
                  <small>MP3, M4A, WAV, AAC or Browse files</small>
                </div>
              ) : (
                <div className="v2-audio-selected">
                  <div className="v2-audio-meta">
                    <Music size={20} />
                    <div className="v2-audio-info">
                      <strong>{audioFile.name}</strong>
                      <span>{formatSize(audioFile.size)}</span>
                    </div>
                  </div>
                  <button type="button" className="v2-btn-icon" onClick={() => setAudioFile(null)}>✕</button>
                </div>
              )}
            </div>
          ) : (
            <div className="v2-form-group">
              <input aria-label="audio url" type="url" value={form.audio_url} onChange={e => setForm({...form, audio_url: e.target.value})} placeholder="https://.../song.mp3" disabled={busy} />
            </div>
          )}

          {/* Mini Audio Preview */}
          {(audioFile || form.audio_url) && (
            <div className="v2-admin-mini-player">
              <button type="button" className="v2-mini-play-btn" onClick={toggleAudioPreview}>
                {audioPreviewPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <span className="v2-mini-player-text">Preview Audio</span>
              <span className="v2-mini-player-time">{formatTime(form.duration)}</span>
              <audio ref={audioRef} onTimeUpdate={() => setPreviewTime(audioRef.current?.currentTime || 0)} onEnded={() => setAudioPreviewPlaying(false)} hidden />
            </div>
          )}
        </div>

        {/* ADVANCED DETAILS */}
        <div className="v2-form-section">
          <button type="button" className="v2-advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
            <h3>Advanced Details</h3>
            {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          
          {showAdvanced && (
            <div className="v2-advanced-content">
              <div className="v2-form-row-3">
                <div className="v2-form-group">
                  <label>Release Date</label>
                  <input type="date" value={form.release_date} onChange={e => setForm({...form, release_date: e.target.value})} disabled={busy} />
                </div>
                <div className="v2-form-group">
                  <label>Track Number</label>
                  <input type="number" min="1" value={form.track_number} onChange={e => setForm({...form, track_number: e.target.value})} disabled={busy} />
                </div>
                <div className="v2-form-group">
                  <label>Duration (secs)</label>
                  <input type="number" min="0" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} disabled={busy} />
                </div>
              </div>
              
              <label className="v2-checkbox-label">
                <input type="checkbox" checked={form.explicit_content} onChange={e => setForm({...form, explicit_content: e.target.checked})} disabled={busy} />
                Explicit Content
              </label>

              <div className="v2-form-group">
                <label>Description / Release Notes</label>
                <textarea rows="3" value={form.description} onChange={e => setForm({...form, description: e.target.value})} disabled={busy} placeholder="Optional description..." />
              </div>

              <div className="v2-form-group">
                <label>Lyrics format</label>
                <select aria-label="lyrics type" value={form.lyrics_type} onChange={e => setForm({...form, lyrics_type: e.target.value})} disabled={busy}><option value="plain">Plain lyrics</option><option value="synced">Synced lyrics</option></select>
              </div>

              {/* AUTO SYNC WITH YOUTUBE & GEMINI */}
              <div className="v2-lyrics-sync-card">
                <div className="v2-sync-header">
                  <div className="v2-sync-title">
                    <Sparkles size={18} className="v2-sync-sparkle-icon" />
                    <strong>Auto Sync with YouTube (Gemini AI)</strong>
                  </div>
                  {syncStatus === 'idle' && (
                    <button
                      type="button"
                      className="v2-btn-outline v2-btn-sm"
                      onClick={() => setShowAutoSyncSection(!showAutoSyncSection)}
                    >
                      {showAutoSyncSection ? 'Hide' : 'Auto Sync Tool'}
                    </button>
                  )}
                </div>

                {showAutoSyncSection && (
                  <div className="v2-sync-content">
                    <div className="v2-form-group">
                      <label htmlFor="sync-source-url">
                        YouTube Source URL
                        {sourceDetected && <span className="v2-source-detected-badge">Detected from media</span>}
                      </label>
                      <input
                        id="sync-source-url"
                        aria-label="YouTube Source URL"
                        type="url"
                        value={sourceUrl}
                        onChange={e => { setSourceUrl(e.target.value); setSyncError('') }}
                        placeholder="https://www.youtube.com/watch?v=..."
                        disabled={busy || syncStatus === 'analyzing'}
                      />
                      <small>The authorized YouTube video used as the audio and timing reference.</small>
                    </div>

                    {sourceWarning && (
                      <div className="v2-status-banner warning" role="alert" style={{ marginBottom: 12 }}>
                        <AlertTriangle size={15} /> {sourceWarning}
                      </div>
                    )}

                    {syncError && (
                      <div className="v2-status-banner error" role="alert" style={{ marginBottom: 12 }}>
                        <XCircle size={15} /> {syncError}
                      </div>
                    )}

                    {syncStatus === 'idle' && (
                      <div className="v2-sync-actions">
                        <button
                          type="button"
                          className="v2-btn-primary"
                          onClick={handleStartAutoSync}
                          disabled={busy || !form.lyrics.trim() || !sourceUrl.trim()}
                        >
                          <Sparkles size={16} /> Auto Sync with YouTube
                        </button>
                        {!form.lyrics.trim() && (
                          <small className="v2-sync-hint">Lyrics required before sync. Enter plain lyrics below first.</small>
                        )}
                      </div>
                    )}

                    {syncStatus === 'analyzing' && (
                      <div className="v2-sync-steps-progress">
                        <div className="v2-sync-step-indicator">
                          <Loader2 size={20} className="spin" />
                          <div>
                            <strong>Step {syncStep}: {syncProgressMsg}</strong>
                            <p>Gemini is analyzing audio timing and aligning canonical lyrics...</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {syncStatus === 'completed' && alignedPreview && (
                      <div className="v2-sync-preview-container">
                        <div className="v2-sync-preview-header">
                          <div>
                            <span className="v2-sync-badge-step">Step 4: Preview</span>
                            <strong>Alignment Complete</strong>
                          </div>
                          {syncQuality && (
                            <div className="v2-sync-quality-stats">
                              <span>Lines: <b>{syncQuality.originalLines}</b></span>
                              <span>Aligned: <b style={{ color: '#34d399' }}>{syncQuality.alignedLines}</b></span>
                              {syncQuality.unmatchedLines > 0 && <span>Unmatched: <b style={{ color: '#f87171' }}>{syncQuality.unmatchedLines}</b></span>}
                              {syncQuality.lowConfidenceLines > 0 && <span>Low Conf: <b style={{ color: '#fbbf24' }}>{syncQuality.lowConfidenceLines}</b></span>}
                              <span>Avg Conf: <b>{Math.round(syncQuality.averageConfidence * 100)}%</b></span>
                            </div>
                          )}
                        </div>

                        {/* Interactive Line-by-line list with confidence */}
                        <div className="v2-sync-lines-wrapper">
                          <div className="v2-sync-lines-list">
                            {alignedPreview.map((line, idx) => {
                              const isActive = (audioPreviewPlaying && activeLyricIndex(alignedPreview, previewTime) === idx)
                              return (
                                <div
                                  key={idx}
                                  className={`v2-sync-line-row ${line.confidenceLevel} ${isActive ? 'active' : ''}`}
                                  onClick={() => toggleAudioPreview(line.start)}
                                  title="Click to seek preview playback to this timestamp"
                                >
                                  <time className="v2-sync-line-time">{lyricTimestamp(line.start)}</time>
                                  <span className="v2-sync-line-text">{line.text}</span>
                                  <span className={`v2-sync-line-conf ${line.confidenceLevel}`}>
                                    {line.confidenceLevel === 'high' ? 'High' : line.confidenceLevel === 'medium' ? 'Med' : 'Low'}
                                    <small>({Math.round(line.confidence * 100)}%)</small>
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Preview Controls */}
                        <div className="v2-sync-preview-controls">
                          <button
                            type="button"
                            className="v2-btn-secondary"
                            onClick={() => toggleAudioPreview()}
                          >
                            {audioPreviewPlaying ? <Pause size={16} /> : <Play size={16} />}
                            {audioPreviewPlaying ? 'Pause Preview' : 'Play Preview'}
                          </button>

                          <button
                            type="button"
                            className="v2-btn-outline"
                            onClick={handleStartAutoSync}
                          >
                            <RotateCcw size={15} /> Re-run Sync
                          </button>

                          <button
                            type="button"
                            className="v2-btn-outline"
                            onClick={() => setShowLrcEditor(!showLrcEditor)}
                          >
                            <Edit3 size={15} /> {showLrcEditor ? 'Hide LRC' : 'Edit LRC'}
                          </button>

                          <button
                            type="button"
                            className="v2-btn-primary"
                            onClick={handleApplySyncedLyrics}
                          >
                            <CheckCircle2 size={16} /> Save Synced Lyrics
                          </button>
                        </div>

                        {showLrcEditor && (
                          <div className="v2-form-group" style={{ marginTop: 14 }}>
                            <label htmlFor="temp-lrc">Edit LRC Timestamps</label>
                            <textarea
                              id="temp-lrc"
                              rows={6}
                              value={lrc || toLrc(alignedPreview)}
                              onChange={e => {
                                setLrc(e.target.value)
                                const rows = parseLrc(e.target.value, form.duration)
                                if (rows.length) {
                                  setAlignedPreview(validateAndAlignTimestamps(form.lyrics, rows, { trackDuration: form.duration }))
                                }
                              }}
                              className="v2-lyrics-input"
                            />
                            <small>Edit timestamps in standard LRC format [mm:ss.xx]Text.</small>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* CANONICAL PLAIN LYRICS */}
              <div className="v2-form-group">
                <label>Canonical Plain Lyrics</label>
                <textarea
                  rows={5}
                  value={form.lyrics}
                  onChange={e => setForm({...form, lyrics: e.target.value})}
                  disabled={busy}
                  placeholder="Optional lyrics..."
                  className="v2-lyrics-input"
                />
                <small>Existing plain lyrics are preserved as canonical text for synchronization and fallback.</small>
              </div>

              {/* SYNCED LYRICS & LRC VIEW */}
              {form.lyrics_type === 'synced' && (
                <div className="v2-form-group">
                  <label htmlFor="track-lrc">Paste LRC</label>
                  <textarea
                    id="track-lrc"
                    rows={7}
                    value={lrc}
                    onChange={e => {
                      setLrc(e.target.value)
                      setForm({ ...form, synced_lyrics: '' })
                      setLyricNotice('Parse the updated LRC before saving.')
                    }}
                    disabled={busy}
                    placeholder={'[00:12.40]First lyric line\n[00:16.20]Second lyric line'}
                    className="v2-lyrics-input"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    className="v2-btn-secondary"
                    onClick={() => {
                      const rows = parseLrc(lrc, form.duration)
                      setForm({ ...form, synced_lyrics: JSON.stringify(rows, null, 2) })
                      setLyricNotice(rows.length ? `${rows.length} lines parsed. Edit timestamps in LRC or JSON below.` : 'No valid timestamped lines found.')
                    }}
                  >
                    Parse / Preview
                  </button>
                  <small role="status">{lyricNotice}</small>
                  <div className="lyric-admin-preview" style={{ maxHeight: 220, overflow: 'auto' }}>
                    {parseSyncedLyrics(form.synced_lyrics).map((line, i) => (
                      <p key={i}><time>{lyricTimestamp(line.start)}</time> {line.text}</p>
                    ))}
                  </div>
                  <details>
                    <summary>Edit timestamps / JSON</summary>
                    <textarea
                      aria-label="synced lyrics"
                      rows={9}
                      value={form.synced_lyrics}
                      onChange={e => setForm({ ...form, synced_lyrics: e.target.value })}
                      disabled={busy}
                      className="v2-lyrics-input"
                    />
                    <small>Each line needs start and end in seconds, and text.</small>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PUBLISHING SETTINGS */}
        <div className="v2-form-section publishing-section">
          <h3>Publishing</h3>
          <div className="v2-publish-cards">
            <label className={`v2-publish-card ${!form.published ? 'active' : ''}`}>
              <input type="radio" name="published" checked={!form.published} onChange={() => setForm({...form, published: false})} disabled={busy} hidden />
              <div className="v2-publish-indicator"></div>
              <div>
                <strong>Draft</strong>
                <p>Only admins can see this track.</p>
              </div>
            </label>
            <label className={`v2-publish-card ${form.published ? 'active' : ''}`}>
              <input type="radio" name="published" checked={form.published} onChange={() => setForm({...form, published: true})} disabled={busy} hidden />
              <div className="v2-publish-indicator"></div>
              <div>
                <strong>Published</strong>
                <p>Track becomes available to all users.</p>
              </div>
            </label>
          </div>
        </div>

        {/* STICKY BOTTOM BAR */}
        <div className="v2-track-form-footer">
          <button type="button" className="v2-btn-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <div className="v2-footer-actions">
            {!form.published && <button aria-label="Save content" type="button" className="v2-btn-draft" disabled={busy} onClick={(e) => submit(e, false)}>Save Draft</button>}
            <button aria-label={isEdit ? 'Save content' : undefined} type="button" className="v2-btn-publish" disabled={busy} onClick={(e) => submit(e, true)}>
              {form.published ? (isEdit ? 'Update Track' : 'Publish Track') : 'Publish Track'}
            </button>
          </div>
        </div>

      </form>
    </div>
  )
}
