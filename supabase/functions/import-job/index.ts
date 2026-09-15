import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validatePodcastSource } from './podcastSource.js'

// Keep this in sync with the headers sent by supabase-js.  In particular,
// browsers preflight the Authorization header before `functions.invoke()`.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
}
const allowedTypes = new Set(['upload', 'url', 'video', 'podcast_episode_url'])

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function validateExternalUrl(value: string) {
  let parsed: URL
  try { parsed = new URL(value) } catch { throw new Error('Enter a valid HTTP or HTTPS URL.') }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported.')
  const host = parsed.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local') || /^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) throw new Error('Private-network URLs are blocked.')
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = request.headers.get('Authorization')
    if (!auth) return response({ error: 'Sign in is required.' }, 401)
    const bearer = auth.match(/^Bearer\s+(.+)$/i)
    if (!bearer?.[1]?.trim()) return response({ error: 'Your session token is invalid.' }, 401)
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return response({ error: 'The import service is not configured.' }, 500)
    }
    const admin = createClient(url, serviceKey)
    const token = bearer[1].trim()
    const { data: userData, error: authError } = await admin.auth.getUser(token)
    if (authError) return response({ error: 'Your session token is invalid.' }, 401)
    if (!userData.user?.id) return response({ error: 'No authenticated user was found for this session.' }, 401)
    const user = userData.user
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (user.app_metadata?.role !== 'admin' && profile?.role !== 'admin') return response({ error: 'Admin access is required.' }, 403)

    const body = await request.json()
    if (body.action === 'retry') {
      const { data, error } = await admin.from('import_jobs').update({ status: 'pending', progress: 0, error_message: null, started_at: null, completed_at: null, cancelled_at: null, retry_count: (body.retry_count || 0) + 1 }).eq('id', body.id).eq('status', 'failed').select().single()
      if (error) throw error
      return response({ job: data })
    }
    if (body.action === 'cancel') {
      const { data, error } = await admin.from('import_jobs').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), error_message: 'Cancelled by administrator.' }).eq('id', body.id).in('status', ['pending', 'processing', 'extracting', 'uploading']).select().single()
      if (error) throw error
      return response({ job: data })
    }
    if (body.action === 'delete') {
      const { error } = await admin.from('import_jobs').delete().eq('id', body.id)
      if (error) throw error
      return response({ deleted: true })
    }

    const sourceType = body.source_type
    let sourceUrl = String(body.source_url || '').trim()
    let podcastFields = {}
    let metadata = body.metadata || {}
    if (!allowedTypes.has(sourceType)) return response({ error: 'Unsupported import type.' }, 400)
    if (sourceType === 'upload') {
      if (!/^storage:\/\/soundverse\/imports\/[0-9a-f-]+\/.+/.test(sourceUrl)) return response({ error: 'Invalid staged upload.' }, 400)
      if (!sourceUrl.includes(`/imports/${user.id}/`)) return response({ error: 'You can only import your own staged upload.' }, 403)
    } else validateExternalUrl(sourceUrl)
    if (sourceType === 'podcast_episode_url') {
      const source = validatePodcastSource(sourceUrl)
      sourceUrl = source.source_url
      if (!body.podcast_id || metadata.authorized !== true) return response({ error: 'Select a podcast and confirm permission to import this media.' }, 400)
      const { data: podcast, error: podcastError } = await admin.from('podcasts').select('id,published').eq('id', body.podcast_id).single()
      if (podcastError || !podcast) return response({ error: 'The selected podcast does not exist.' }, 400)
      if (!podcast.published) return response({ error: 'Publish the selected podcast before importing an episode.' }, 400)
      for (const field of ['episode_number', 'season_number']) if (metadata[field] != null && (!Number.isInteger(metadata[field]) || metadata[field] < 1)) return response({ error: 'Episode and season numbers must be positive whole numbers.' }, 400)
      metadata = { authorized: true, title: String(metadata.title || '').slice(0,500), description: String(metadata.description || '').slice(0,20000), cover_url: metadata.cover_url ? String(metadata.cover_url) : null, episode_number: metadata.episode_number || null, season_number: metadata.season_number || null }
      if (metadata.cover_url) validateExternalUrl(metadata.cover_url)
      podcastFields = { podcast_id: podcast.id, source_platform: source.source_platform, source_id: source.source_id }
      if (source.source_id) {
        const { data: duplicate, error: lookupError } = await admin.from('episodes').select('id').eq('source_platform', source.source_platform).eq('source_id', source.source_id).maybeSingle()
        if (lookupError) throw lookupError
        if (duplicate) return response({ error: 'This source has already been imported as an episode.' }, 409)
      }
    }
    const { data, error } = await admin.from('import_jobs').insert({
      source_url: sourceUrl,
      source_type: sourceType,
      status: 'pending',
      created_by: user.id,
      metadata,
      ...podcastFields,
    }).select().single()
    if (error?.code === '23505') return response({ error: 'This source is already queued or imported.' }, 409)
    if (error) throw error
    // This function only validates and queues work. In particular, video jobs
    // must remain pending for the long-running Node audio worker; invoking the
    // Edge `process-import` function would claim and reject them.
    return response({ job: data }, 201)
  } catch (error) {
    console.error(error)
    return response({ error: error instanceof Error ? error.message : 'Unable to create import job.' }, 400)
  }
})
