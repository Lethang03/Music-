import React, { useState, useEffect, useRef, useMemo } from 'react'
import { X, Play, Pause, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Loader2, Sparkles, Filter } from 'lucide-react'
import { BatchLyricsSyncRunner } from '../../../lib/geminiLyricsSync'
import { splitLyricsToLines } from '../../../lib/lyrics'
import './BatchLyricsSyncModal.css'

export default function BatchLyricsSyncModal({ tracks = [], onClose, onTrackSaved, onEditTrack }) {
  const [forceResync, setForceResync] = useState(false)
  const [autoSave, setAutoSave] = useState(false)
  const [concurrency, setConcurrency] = useState(1)
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'needs_review' | 'failed' | 'completed'

  const [stats, setStats] = useState({
    status: 'idle',
    total: 0,
    completed: 0,
    needsReview: 0,
    failed: 0,
    queued: 0,
    analyzing: 0,
    percent: 0
  })
  const [itemsMap, setItemsMap] = useState({})

  const runnerRef = useRef(null)

  // Filter eligible tracks
  const eligibleTracks = useMemo(() => {
    return tracks.filter(t => {
      const hasPlain = splitLyricsToLines(t.lyrics).length > 0
      const hasSynced = t.lyrics_type === 'synced' && Array.isArray(t.synced_lyrics) && t.synced_lyrics.length > 0
      return hasPlain && (forceResync || !hasSynced)
    })
  }, [tracks, forceResync])

  // Initialize runner when tracks or options change (if idle)
  useEffect(() => {
    if (stats.status === 'idle') {
      const runner = new BatchLyricsSyncRunner({
        tracks,
        options: { forceResync, autoSave, concurrency },
        onProgress: (newStats) => setStats({ ...newStats }),
        onTrackUpdate: (item) => {
          setItemsMap(prev => ({ ...prev, [item.track.id]: { ...item } }))
          if (item.status === 'completed' && autoSave) {
            onTrackSaved?.(item.track.id)
          }
        },
        onComplete: () => {
          onTrackSaved?.()
        }
      })
      runner.init()
      runnerRef.current = runner
      setStats(runner.getStats())
      const initialMap = {}
      for (const [id, item] of runner.items.entries()) {
        initialMap[id] = item
      }
      setItemsMap(initialMap)
    }
  }, [tracks, forceResync, autoSave, concurrency, stats.status, onTrackSaved])

  const handleStart = () => {
    if (runnerRef.current) {
      runnerRef.current.start()
      setStats(runnerRef.current.getStats())
    }
  }

  const handlePause = () => {
    if (runnerRef.current) {
      runnerRef.current.pause()
      setStats(runnerRef.current.getStats())
    }
  }

  const handleResume = () => {
    if (runnerRef.current) {
      runnerRef.current.resume()
      setStats(runnerRef.current.getStats())
    }
  }

  const handleRetryFailed = () => {
    if (runnerRef.current) {
      runnerRef.current.retryFailed()
      setStats(runnerRef.current.getStats())
    }
  }

  const handleClose = () => {
    if (stats.status === 'running') {
      if (!window.confirm('Batch sync is in progress. Closing will stop the queue. Proceed?')) {
        return
      }
      runnerRef.current?.stop()
    }
    onClose()
  }

  const itemsList = Object.values(itemsMap)
  const filteredItems = itemsList.filter(item => {
    if (filterStatus === 'all') return true
    return item.status === filterStatus
  })

  return (
    <div className="v2-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="batch-sync-title">
      <div className="v2-batch-modal">
        <div className="v2-batch-header">
          <div className="v2-batch-title-area">
            <Sparkles className="v2-batch-icon" size={22} />
            <div>
              <h2 id="batch-sync-title">Auto Sync Existing Lyrics</h2>
              <p>Automatically align plain lyrics to authorized YouTube sources using Gemini</p>
            </div>
          </div>
          <button type="button" className="v2-btn-icon" onClick={handleClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="v2-batch-body">
          {/* Options & Eligibility */}
          <div className="v2-batch-options">
            <div className="v2-batch-eligibility">
              <strong>{eligibleTracks.length} tracks eligible</strong>
              <small>Tracks with plain lyrics requiring synchronization</small>
            </div>

            <div className="v2-batch-toggles">
              <label className="v2-checkbox-label">
                <input
                  type="checkbox"
                  checked={forceResync}
                  onChange={e => setForceResync(e.target.checked)}
                  disabled={stats.status === 'running'}
                />
                Force Re-sync (include already synced tracks)
              </label>

              <label className="v2-checkbox-label">
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={e => setAutoSave(e.target.checked)}
                  disabled={stats.status === 'running'}
                />
                Auto-save high-confidence results
              </label>

              <div className="v2-batch-concurrency">
                <label htmlFor="batch-concurrency">Concurrency:</label>
                <select
                  id="batch-concurrency"
                  value={concurrency}
                  onChange={e => setConcurrency(Number(e.target.value))}
                  disabled={stats.status === 'running'}
                >
                  <option value={1}>1 track at a time (Recommended)</option>
                  <option value={2}>2 tracks at a time</option>
                </select>
              </div>
            </div>
          </div>

          {/* Progress Bar & Counters */}
          <div className="v2-batch-progress-box">
            <div className="v2-batch-counters">
              <span className="v2-batch-stat total">Total: {stats.total}</span>
              <span className="v2-batch-stat completed">Completed: {stats.completed}</span>
              <span className="v2-batch-stat review">Needs Review: {stats.needsReview}</span>
              <span className="v2-batch-stat failed">Failed: {stats.failed}</span>
              <span className="v2-batch-stat queued">Queued: {stats.queued}</span>
            </div>

            <div className="v2-batch-progress-bar">
              <div
                className="v2-batch-progress-fill"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
            <div className="v2-batch-progress-meta">
              <span>{stats.completed + stats.needsReview + stats.failed} / {stats.total} processed ({stats.percent}%)</span>
              <span className="v2-batch-status-badge">{stats.status.toUpperCase()}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="v2-batch-controls">
            {stats.status === 'idle' && (
              <button
                type="button"
                className="v2-btn-primary"
                onClick={handleStart}
                disabled={eligibleTracks.length === 0}
              >
                <Play size={16} /> Start Batch Sync
              </button>
            )}

            {stats.status === 'running' && (
              <button type="button" className="v2-btn-secondary" onClick={handlePause}>
                <Pause size={16} /> Pause
              </button>
            )}

            {stats.status === 'paused' && (
              <button type="button" className="v2-btn-primary" onClick={handleResume}>
                <Play size={16} /> Resume
              </button>
            )}

            {(stats.status === 'completed' || stats.status === 'paused') && stats.failed > 0 && (
              <button type="button" className="v2-btn-outline" onClick={handleRetryFailed}>
                <RefreshCw size={16} /> Retry Failed ({stats.failed})
              </button>
            )}

            <div className="v2-batch-filter">
              <Filter size={14} />
              <select
                aria-label="Filter status"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="all">All ({itemsList.length})</option>
                <option value="completed">Completed ({stats.completed})</option>
                <option value="needs_review">Needs Review ({stats.needsReview})</option>
                <option value="failed">Failed ({stats.failed})</option>
              </select>
            </div>
          </div>

          {/* Track Status List */}
          <div className="v2-batch-list">
            {filteredItems.length === 0 ? (
              <div className="v2-batch-empty">No tracks in this view.</div>
            ) : (
              filteredItems.map(item => (
                <div key={item.track.id} className={`v2-batch-item ${item.status}`}>
                  <div className="v2-batch-item-info">
                    <strong>{item.track.title}</strong>
                    <small>{item.track.artist || 'Unknown Artist'}</small>
                    {item.error && <p className="v2-batch-item-error">{item.error}</p>}
                    {item.quality && (
                      <p className="v2-batch-item-quality">
                        {item.quality.alignedLines} lines aligned · Avg confidence: {Math.round(item.quality.averageConfidence * 100)}%
                        {item.quality.lowConfidenceLines > 0 && ` · ${item.quality.lowConfidenceLines} low confidence`}
                      </p>
                    )}
                  </div>

                  <div className="v2-batch-item-state">
                    {item.status === 'analyzing' && (
                      <span className="v2-status-pill analyzing">
                        <Loader2 size={13} className="spin" /> Analyzing...
                      </span>
                    )}
                    {item.status === 'queued' && (
                      <span className="v2-status-pill queued">Queued</span>
                    )}
                    {item.status === 'completed' && (
                      <span className="v2-status-pill completed">
                        <CheckCircle2 size={13} /> Completed
                      </span>
                    )}
                    {item.status === 'needs_review' && (
                      <span className="v2-status-pill review">
                        <AlertTriangle size={13} /> Needs Review
                      </span>
                    )}
                    {item.status === 'failed' && (
                      <span className="v2-status-pill failed">
                        <XCircle size={13} /> Failed
                      </span>
                    )}

                    {onEditTrack && (item.status === 'completed' || item.status === 'needs_review') && (
                      <button
                        type="button"
                        className="v2-btn-outline v2-btn-xs"
                        onClick={() => {
                          onClose()
                          onEditTrack(item.track)
                        }}
                      >
                        Review / Edit
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

