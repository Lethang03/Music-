import React, { useState, useEffect, useRef } from 'react'
import { UploadCloud, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

class PodcastImportQueueManager {
  constructor(onUpdate) {
    this.queue = []
    this.onUpdate = onUpdate
    this.isProcessing = false
  }

  addJob(url) {
    const job = {
      id: Date.now().toString() + Math.random().toString(36).substring(2),
      url,
      status: 'Waiting',
      progress: 0,
      metadata: null,
      error: null
    }
    this.queue.push(job)
    this.notify()
    this.processNext()
    return job
  }

  updateJob(id, updates) {
    const job = this.queue.find(j => j.id === id)
    if (job) {
      Object.assign(job, updates)
      this.notify()
    }
  }

  notify() {
    this.onUpdate([...this.queue])
  }

  async processNext() {
    if (this.isProcessing) return
    const nextJob = this.queue.find(j => j.status === 'Waiting')
    if (!nextJob) return

    this.isProcessing = true
    await this.processJob(nextJob)
    this.isProcessing = false
    this.processNext()
  }

  async processJob(job) {
    try {
      this.updateJob(job.id, { status: 'Fetching RSS feed', progress: 10 })
      
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(job.url)}`
      const response = await fetch(proxyUrl)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      
      const xmlText = await response.text()
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlText, "text/xml")
      
      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('Invalid XML format')
      }

      this.updateJob(job.id, { status: 'Parsing metadata', progress: 40 })

      const channel = xmlDoc.querySelector('channel')
      if (!channel) throw new Error('No channel element found in RSS feed')

      const title = channel.querySelector('title')?.textContent || 'Imported Podcast'
      const description = channel.querySelector('description')?.textContent || ''
      const author = channel.querySelector('itunes\\:author, author')?.textContent || ''
      let cover_url = channel.querySelector('itunes\\:image, image')?.getAttribute('href') || channel.querySelector('image > url')?.textContent || null

      this.updateJob(job.id, { status: 'Creating Podcast', progress: 60 })

      const { data: { session } } = await supabase.auth.getSession()

      const podcastPayload = {
        title,
        description,
        author,
        cover_url,
        published: true, // We auto-publish the podcast shell
        owner_id: session?.user?.id
      }

      const { data: podcastData, error: podcastError } = await supabase
        .from('podcasts')
        .insert(podcastPayload)
        .select()
        .single()

      if (podcastError) throw podcastError

      this.updateJob(job.id, { status: 'Importing Episodes', progress: 80 })

      const items = Array.from(xmlDoc.querySelectorAll('item'))
      const episodePayloads = []

      // Extract episodes (limit to 50 for safety/performance in frontend)
      for (let i = 0; i < Math.min(items.length, 50); i++) {
        const item = items[i]
        const epTitle = item.querySelector('title')?.textContent || 'Untitled Episode'
        const epDesc = item.querySelector('description')?.textContent || ''
        const enclosure = item.querySelector('enclosure')
        const audioUrl = enclosure ? enclosure.getAttribute('url') : null
        
        let durationStr = item.querySelector('itunes\\:duration, duration')?.textContent
        let duration = null
        if (durationStr) {
          if (durationStr.includes(':')) {
            const parts = durationStr.split(':').map(Number)
            if (parts.length === 3) duration = parts[0]*3600 + parts[1]*60 + parts[2]
            else if (parts.length === 2) duration = parts[0]*60 + parts[1]
          } else {
            duration = parseInt(durationStr, 10)
          }
        }

        const season = item.querySelector('itunes\\:season, season')?.textContent
        const epNum = item.querySelector('itunes\\:episode, episode')?.textContent

        if (audioUrl) {
          episodePayloads.push({
            podcast_id: podcastData.id,
            title: epTitle,
            description: epDesc,
            audio_url: audioUrl, // Point directly to original source URL
            duration: isNaN(duration) ? null : duration,
            season_number: season ? Number(season) : null,
            episode_number: epNum ? Number(epNum) : null,
            published: true // publish immediately
          })
        }
      }

      if (episodePayloads.length > 0) {
        const { error: epsError } = await supabase.from('episodes').insert(episodePayloads)
        if (epsError) throw epsError
      }

      this.updateJob(job.id, { 
        status: 'Completed', 
        progress: 100,
        metadata: { title, episodesCount: episodePayloads.length }
      })
    } catch (err) {
      console.error(err)
      this.updateJob(job.id, { status: 'Failed', error: err.message, progress: 0 })
    }
  }
}

export default function AdminPodcastImport() {
  const [url, setUrl] = useState('')
  const [queue, setQueue] = useState([])
  const queueManager = useRef(null)

  useEffect(() => {
    if (!queueManager.current) {
      queueManager.current = new PodcastImportQueueManager(setQueue)
    }
  }, [])

  const handleImport = (e) => {
    e.preventDefault()
    if (!url.trim()) return
    queueManager.current.addJob(url.trim())
    setUrl('')
  }

  return (
    <div className="v2-admin-section-page">
      <div className="v2-admin-header-inline">
        <h2>Import Podcast</h2>
        <p>Import podcast and episodes via RSS feed URL.</p>
      </div>

      <div className="v2-admin-import-card">
        <form onSubmit={handleImport} className="v2-admin-import-form">
          <div className="v2-form-group flex-1">
            <label>RSS Feed URL</label>
            <input 
              type="url" 
              placeholder="https://anchor.fm/s/12345/podcast/rss" 
              value={url} 
              onChange={e => setUrl(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="v2-btn-primary" style={{ marginTop: 'auto' }}>
            <UploadCloud size={18} />
            Import Podcast
          </button>
        </form>
      </div>

      <div className="v2-admin-queue-section">
        <h3>Import Queue</h3>
        {queue.length === 0 ? (
          <div className="v2-admin-empty">No RSS feeds in queue.</div>
        ) : (
          <div className="v2-admin-queue-list">
            {queue.slice().reverse().map(job => (
              <div key={job.id} className={`v2-admin-queue-item ${job.status.toLowerCase().replace(' ', '-')}`}>
                <div className="v2-queue-item-info">
                  <strong>{job.metadata?.title || job.url.split('/').pop()}</strong>
                  <small>{job.url}</small>
                  {job.metadata?.episodesCount !== undefined && (
                    <small>Imported {job.metadata.episodesCount} episodes</small>
                  )}
                  <div className="v2-queue-status">
                    {job.status === 'Completed' && <CheckCircle size={14} className="success" />}
                    {job.status === 'Failed' && <XCircle size={14} className="danger" />}
                    {job.status !== 'Completed' && job.status !== 'Failed' && <Loader2 size={14} className="spin" />}
                    <span>{job.status}</span>
                  </div>
                  {job.error && <div className="v2-queue-error">{job.error}</div>}
                </div>
                
                {job.status !== 'Failed' && job.status !== 'Completed' && (
                  <div className="v2-queue-progress-bar">
                    <div className="v2-queue-progress-fill" style={{ width: `${job.progress}%` }}></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

