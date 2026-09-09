import React, { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, XCircle, FileAudio, Link2, Loader2, RefreshCw, Trash2, Video } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { importAction, queueUpload, queueUrl } from '../../../lib/audioImport'
import { useAuth } from '../../../contexts/AuthContext'
import { useLibrary } from '../../../contexts/LibraryContext'

const tabs = [{ id: 'upload', label: 'Upload File', icon: FileAudio }, { id: 'url', label: 'Import URL', icon: Link2 }, { id: 'video', label: 'Import Source', icon: Video }]
const active = status => ['pending', 'processing', 'extracting', 'uploading'].includes(status)
const labels = { pending: 'Pending', processing: 'Preparing', extracting: 'Extracting audio', uploading: 'Uploading', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled' }

export default function AdminMusicImport() {
  const { session } = useAuth(); const { loadPublicLibrary } = useLibrary()
  const [tab, setTab] = useState('upload'); const [file, setFile] = useState(null); const [url, setUrl] = useState(''); const [jobs, setJobs] = useState([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const loadedCompleted = useRef(new Set())
  
  const loadJobs = useCallback(async () => { 
    try {
      const { data, error: queryError } = await supabase.from('import_jobs').select('*').order('created_at', { ascending: false }).limit(50); 
      if (queryError) throw queryError; 
      setJobs(data || []) 
    } catch (err) {
      setError(err.message)
    }
  }, [])
  
  useEffect(() => { loadJobs(); const timer = setInterval(loadJobs, 3000); return () => clearInterval(timer) }, [loadJobs])
  
  useEffect(() => { 
    const fresh = jobs.filter(job => job.status === 'completed' && !loadedCompleted.current.has(job.id)); 
    if (fresh.length) { fresh.forEach(job => loadedCompleted.current.add(job.id)); loadPublicLibrary() } 
    
  }, [jobs, loadJobs, loadPublicLibrary])
  
  const submit = async event => { 
    event.preventDefault(); setError(''); setBusy(true); 
    try { 
      if (!session?.user?.id) throw new Error('Sign in again before importing music.'); 
      if (tab === 'upload') { 
        await queueUpload(file, session.user.id); 
        setFile(null); 
        event.currentTarget.reset() 
      } else {
        await queueUrl(url, tab === 'video' ? 'video' : 'url'); 
      }
      setUrl(''); 
      await loadJobs() 
    } catch (err) { setError(err.message) } finally { setBusy(false) } 
  }
  
  const action = async (kind, job) => { setError(''); try { await importAction(kind, job); await loadJobs() } catch (err) { setError(err.message) } }
  
  return <div className="v2-admin-section-page audio-import-page">
    <div className="v2-admin-header-inline"><h2>Import Music</h2><p>Imports are processed immediately and automatically added to the published music library when complete.</p></div>
    <div className="audio-import-card"><div className="audio-import-tabs" role="tablist">{tabs.map(item => { const Icon = item.icon; return <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'selected' : ''} onClick={() => setTab(item.id)}><Icon size={16} />{item.label}</button> })}</div>
      <form onSubmit={submit} className="audio-import-form">{tab === 'upload' ? <label className="audio-file-picker"><FileAudio size={22} /><span>{file ? file.name : 'Choose an audio file'}</span><small>MP3, WAV, M4A, AAC, OGG, Opus, FLAC, WebM · max 500 MB</small><input type="file" accept="audio/*,.opus,.flac,.webm" onChange={e => setFile(e.target.files?.[0] || null)} required /></label> : <label className="v2-form-group"><span>{tab === 'video' ? 'Video/audio source URL' : 'Import Source URL'}</span><input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder={tab === 'video' ? 'https://www.youtube.com/watch?v=…' : 'https://example.com/audio.wav'} required /><small>{tab === 'video' ? 'Video/audio sources are extracted and normalized by the worker.' : 'The worker downloads, inspects, and normalizes the source.'}</small></label>}<button className="v2-btn-primary" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : <FileAudio size={18} />}{busy ? 'Queuing…' : 'Create import job'}</button></form>{error && <div className="v2-status-banner error" role="alert">{error}</div>}</div>
    <section className="v2-admin-queue-section"><div className="queue-heading"><h3>Processing queue</h3><button className="v2-btn-outline v2-btn-sm" onClick={loadJobs}>Refresh</button></div>{!jobs.length ? <div className="v2-admin-empty">No import jobs yet.</div> : <div className="import-job-list">{jobs.map(job => <article className={`import-job ${job.status}`} key={job.id}><div className="import-job-main"><strong>{job.metadata?.title || job.source_url.split('/').pop() || 'Untitled import'}</strong><small title={job.source_url}>{job.source_url}</small>{job.error_message && <p className="v2-queue-error">{job.error_message}</p>}</div><div className="import-job-state">{job.status === 'completed' ? <CheckCircle2 size={17} /> : job.status === 'failed' || job.status === 'cancelled' ? <XCircle size={17} /> : <Loader2 className="spin" size={17} />}<span>{labels[job.status] || job.status}</span></div><div className="import-job-progress"><span>{job.progress}%</span><i><b style={{ width: `${job.progress}%` }} /></i></div><div className="import-job-actions">{job.status === 'failed' && <button title="Retry" onClick={() => action('retry', job)}><RefreshCw size={16} /></button>}{active(job.status) && <button title="Cancel" onClick={() => action('cancel', job)}><XCircle size={16} /></button>}{!active(job.status) && <button title="Delete" onClick={() => action('delete', job)}><Trash2 size={16} /></button>}</div></article>)}</div>}</section>
    <style>{`.audio-import-card{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px;margin-bottom:28px}.audio-import-tabs{display:flex;gap:8px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:20px}.audio-import-tabs button{border:0;background:none;color:var(--text-secondary);padding:10px 12px;display:flex;align-items:center;gap:7px;border-bottom:2px solid transparent}.audio-import-tabs button.selected{color:var(--text);border-color:#8b5cf6}.audio-import-form{display:flex;gap:16px;align-items:flex-end}.audio-import-form .v2-form-group{flex:1;margin:0}.audio-import-form small,.audio-file-picker small{color:var(--text-secondary);display:block;margin-top:6px}.audio-file-picker{flex:1;min-height:96px;border:1px dashed rgba(255,255,255,.25);border-radius:9px;padding:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer}.audio-file-picker input{position:absolute;width:1px;height:1px;opacity:0}.queue-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.import-job-list{display:grid;gap:10px}.import-job{display:grid;grid-template-columns:minmax(180px,1fr) 150px 130px 38px;align-items:center;gap:16px;padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:9px}.import-job-main{min-width:0}.import-job-main strong,.import-job-main small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.import-job-main small{color:var(--text-secondary);margin-top:3px}.import-job-state{display:flex;gap:6px;align-items:center;font-size:.85rem}.completed .import-job-state{color:#34d399}.failed .import-job-state,.cancelled .import-job-state{color:#f87171}.import-job-progress{font-size:.78rem}.import-job-progress i{display:block;height:5px;background:rgba(255,255,255,.1);border-radius:8px;overflow:hidden;margin-top:5px}.import-job-progress b{display:block;height:100%;background:var(--accent-gradient)}.import-job-actions button{border:0;background:transparent;color:var(--text-secondary);padding:6px}@media(max-width:700px){.audio-import-form{display:block}.audio-import-form button{margin-top:15px}.import-job{grid-template-columns:1fr auto;gap:10px}.import-job-progress{grid-column:1}.import-job-actions{grid-column:2;grid-row:1}.audio-import-tabs{overflow:auto}.audio-import-tabs button{white-space:nowrap}}`}</style>
  </div>
}
