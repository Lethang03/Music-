import { mediaProvider } from '../../../services/media'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { createImportJob, importAction } from '../../../lib/audioImport'
import { validatePodcastSource } from '../../../../workers/audio-worker/podcastSource'
import { useLibrary } from '../../../contexts/LibraryContext'

// Only fixed, user-facing messages cross the error presentation boundary.
function importErrorMessage(error) {
  const message = String(error?.message || '')
  if (/already|duplicate/i.test(message)) return 'This source is already queued or imported.'
  if (/select a podcast/i.test(message)) return 'Select a podcast.'
  if (/permission|authorized/i.test(message)) return 'Confirm permission before importing.'
  if (/episode.*season|whole number/i.test(message)) return 'Episode and season numbers must be positive whole numbers.'
  if (/podcast.*(?:not found|does not exist|unavailable|unpublished)/i.test(message)) return 'Podcast not found or unpublished. Select a published podcast.'
  if (/session|sign in|authenticated|admin access/i.test(message)) return 'Sign in with an administrator account before importing.'
  if (/url|unsupported|public video/i.test(message)) return 'Unsupported source URL. Paste a public TikTok or YouTube video URL.'
  if (/worker|service|network|fetch/i.test(message)) return 'The import service is unavailable. Please retry.'
  return 'Episode import failed. Please retry.'
}

export default function PodcastUrlImport() {
  const { loadPublicLibrary, podcasts: catalogPodcasts, loading } = useLibrary()
  const podcasts = useMemo(() => catalogPodcasts.filter(podcast => podcast.published), [catalogPodcasts])
  const [form, setForm] = useState({ source_url: '', podcast_id: '', title: '', description: '', episode_number: '', season_number: '', cover_url: '', authorized: false })
  const [jobs, setJobs] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selectedPodcast = podcasts.find(podcast => podcast.id === form.podcast_id)
  const completed = useRef(new Set())
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('import_jobs').select('*').eq('source_type', 'podcast_episode_url').order('created_at', { ascending: false }).limit(50)
    if (error) { setError('Unable to load the episode import queue.'); return }
    setJobs(data || [])
    const fresh = (data || []).filter(job => job.status === 'completed' && !completed.current.has(job.id))
    if (fresh.length) { fresh.forEach(job => completed.current.add(job.id)); loadPublicLibrary() }
  }, [loadPublicLibrary])
  useEffect(() => {
    load(); const timer = setInterval(load, 3000)
    return () => { clearInterval(timer) }
  }, [load])
  const field = (name, label, type = 'text') => <label className="v2-form-group">{label}<input type={type} value={form[name]} min={type === 'number' ? 1 : undefined} step={type === 'number' ? 1 : undefined} onChange={e => setForm({ ...form, [name]: e.target.value })}/></label>
  let detected = ''
  try { detected = validatePodcastSource(form.source_url).source_platform } catch {}
  const valid = Boolean(detected && selectedPodcast && form.authorized)
  const guidance = !detected ? 'Enter a valid TikTok / YouTube URL.' : !selectedPodcast ? 'Select a podcast.' : !form.authorized ? 'Confirm permission before importing.' : 'Ready to import this episode.'
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const source = validatePodcastSource(form.source_url)
      if (!selectedPodcast) throw new Error('Select a podcast.')
      if (!form.authorized) throw new Error('Confirm permission before importing.')
      await createImportJob({ source_type: 'podcast_episode_url', source_url: source.source_url, podcast_id: form.podcast_id, metadata: { title: form.title.trim(), description: form.description.trim(), cover_url: form.cover_url || null, episode_number: form.episode_number ? Number(form.episode_number) : null, season_number: form.season_number ? Number(form.season_number) : null, authorized: true } })
      setForm({ ...form, source_url: '', title: '', description: '', authorized: false }); await load()
    } catch (err) { setError(importErrorMessage(err)) } finally { setBusy(false) }
  }
  const action = async (name, job) => { setBusy(true); setError(''); try { await importAction(name, job); await load() } catch { setError('Unable to update this import job.') } finally { setBusy(false) } }
  const labels = { pending: 'Pending', processing: 'Pending', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled' }
  return <section className="podcast-url-import">
    <form onSubmit={submit} className="podcast-url-form">
      <header className="podcast-url-form-header"><h3>Import TikTok / YouTube Episode</h3><p>Import one authorized video into a published podcast.</p></header>
      <div className="v2-form-group"><div className="podcast-source-heading"><label htmlFor="podcast-source-url">Source URL</label>{detected && <span className="podcast-source-badge">{detected === 'youtube' ? 'YouTube' : 'TikTok'}</span>}</div><input id="podcast-source-url" type="url" required value={form.source_url} aria-invalid={Boolean(form.source_url && !detected)} aria-describedby="podcast-source-help podcast-source-error" onChange={e => { setForm({ ...form, source_url: e.target.value }); setError('') }}/><small id="podcast-source-help" className="podcast-import-hint">Paste an authorized TikTok or YouTube video URL.</small><small id="podcast-source-error" className="podcast-field-error">{form.source_url && !detected ? 'Invalid TikTok / YouTube URL. Use a public video or share link.' : ''}</small></div>
      <div className="v2-form-group"><label htmlFor="podcast-import-target">Podcast</label><select id="podcast-import-target" required disabled={!podcasts.length || busy} value={selectedPodcast ? form.podcast_id : ''} onChange={e => setForm({ ...form, podcast_id: e.target.value })}><option value="">Select podcast</option>{podcasts.map(p => <option key={p.id} value={p.id} disabled={!p.published}>{p.title}{p.published ? '' : ' (unpublished)'}</option>)}</select></div>
      {selectedPodcast && <div className="podcast-selected-preview">{selectedPodcast.cover_url && <img src={mediaProvider.getCoverUrl(selectedPodcast.cover_url)} alt=""/>}<strong>{selectedPodcast.title}</strong></div>}
      {!podcasts.length && <div className="podcast-import-empty">{loading ? 'Loading published podcasts…' : <><strong>No published podcasts available.</strong>Create or publish a podcast first.</>}</div>}
      {field('title', 'Title (optional)')}
      <label className="v2-form-group">Description (optional)<textarea value={form.description} rows={3} onChange={e => setForm({ ...form, description: e.target.value })}/></label>
      <div className="podcast-episode-numbers">{field('episode_number', 'Episode number (optional)', 'number')}{field('season_number', 'Season (optional)', 'number')}</div>
      {field('cover_url', 'Episode artwork URL (optional)', 'url')}
      <label className="podcast-permission"><input type="checkbox" required checked={form.authorized} onChange={e => setForm({ ...form, authorized: e.target.checked })}/>I own this content or have permission to import it.</label>
      <p id="podcast-import-guidance" role="status" className="podcast-import-validation">{guidance}</p>
      <button type="submit" className="v2-btn-primary" disabled={busy || !valid} aria-describedby="podcast-import-guidance">Import Episode</button>
    </form>
    {error && <p className="podcast-import-error" role="alert">{error}</p>}
    <section className="podcast-import-queue"><h3>Episode Import Queue</h3>
    {!jobs.length && <p>No episode imports yet.</p>}
    {jobs.map(job => <article key={job.id} className="podcast-import-job"><strong>{job.metadata?.title || `${job.source_platform} episode`}</strong><small>{job.source_url}</small><span role="status">{labels[job.status] || job.metadata?.stage || (job.status === 'uploading' ? 'Uploading' : 'Extracting')}</span><progress max={100} value={job.progress}/>{job.status === 'failed' && <><p>Import failed. Check that the video is publicly accessible and authorized.</p><button disabled={busy} onClick={() => action('retry', job)}>Retry</button></>}{['pending','processing','extracting','uploading'].includes(job.status) && <button disabled={busy} onClick={() => action('cancel', job)}>Cancel</button>}</article>)}
    </section>
  </section>
}
