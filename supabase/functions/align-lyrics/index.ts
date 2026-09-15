import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validatePodcastSource } from './podcastSource.js'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
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
      return response({ error: 'The backend service is not configured.' }, 500)
    }

    const admin = createClient(url, serviceKey)
    const token = bearer[1].trim()
    const { data: userData, error: authError } = await admin.auth.getUser(token)
    if (authError || !userData.user?.id) {
      return response({ error: 'Your session token is invalid.' }, 401)
    }

    const user = userData.user
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (user.app_metadata?.role !== 'admin' && profile?.role !== 'admin') {
      return response({ error: 'Admin access is required.' }, 403)
    }

    const body = await request.json()
    const rawSourceUrl = String(body.source_url || '').trim()
    if (!rawSourceUrl) return response({ error: 'A YouTube source URL is required.' }, 400)

    let source
    try {
      source = validatePodcastSource(rawSourceUrl)
      if (source.source_platform !== 'youtube') {
        throw new Error('Only YouTube source URLs are supported for lyrics synchronization.')
      }
    } catch (err: any) {
      return response({ error: err.message || 'Invalid YouTube URL.' }, 400)
    }

    const lyrics = String(body.lyrics || '').trim()
    if (!lyrics) {
      return response({ error: 'Lyrics required before sync. Please enter plain lyrics first.' }, 400)
    }

    const lines = lyrics
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)

    if (!lines.length) {
      return response({ error: 'Lyrics contains no readable lines.' }, 400)
    }

    const title = String(body.title || 'Unknown Title').slice(0, 500)
    const artist = String(body.artist || 'Unknown Artist').slice(0, 500)
    const trackDuration = Number(body.duration) || 0

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return response({ error: 'Gemini API key is not configured on the server.' }, 503)
    }

    const modelName = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash'
    const linesPrompt = lines.map((line, idx) => `[${idx}] ${line}`).join('\n')

    const promptText = `You are a professional audio-to-lyrics timing aligner.
Listen carefully to the audio of the attached YouTube video and align each given lyric line with its exact start and end timestamps in seconds.

Song Information:
Title: ${title}
Artist: ${artist}
Expected Duration: ${trackDuration > 0 ? `${trackDuration} seconds` : 'unknown'}

Canonical Lyric Lines to Align (in exact sequence):
${linesPrompt}

Alignment Rules:
1. You MUST use the exact given lyric lines in their exact provided sequence. Do NOT alter, summarize, or correct spelling.
2. For each line, return:
   - "line_index": the integer index [0 to ${lines.length - 1}]
   - "text": the exact canonical lyric line string
   - "start": timestamp in seconds when the line starts being sung (e.g. 14.25)
   - "end": timestamp in seconds when the line finishes being sung (e.g. 18.60)
   - "confidence": confidence score float between 0.00 and 1.00 for this line's alignment accuracy
3. Every "start" timestamp must be >= 0.
4. "end" must be strictly greater than "start".
5. Timestamps must be strictly ascending: line i+1 must start after or when line i starts.
6. Return strictly the structured JSON array matching the schema.`

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`

    const requestBody = {
      contents: [
        {
          parts: [
            {
              fileData: {
                fileUri: source.source_url,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              line_index: { type: 'INTEGER' },
              text: { type: 'STRING' },
              start: { type: 'NUMBER' },
              end: { type: 'NUMBER' },
              confidence: { type: 'NUMBER' },
            },
            required: ['line_index', 'text', 'start', 'end', 'confidence'],
          },
        },
      },
    }

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    if (!geminiRes.ok) {
      let errDetails = ''
      try {
        const errJson = await geminiRes.json()
        errDetails = errJson?.error?.message || JSON.stringify(errJson)
      } catch {
        errDetails = await geminiRes.text()
      }
      console.error(`Gemini API error (${geminiRes.status}):`, errDetails)
      return response({
        error: `Gemini timing analysis failed (${geminiRes.status}): ${errDetails.slice(0, 300)}`,
        status: 'failed',
      }, 502)
    }

    const geminiData = await geminiRes.json()
    const contentText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!contentText) {
      return response({ error: 'Gemini returned an empty alignment response.', status: 'failed' }, 502)
    }

    let parsedAlignment = []
    try {
      parsedAlignment = JSON.parse(contentText)
    } catch {
      return response({ error: 'Failed to parse Gemini structured alignment data.', status: 'failed' }, 502)
    }

    if (!Array.isArray(parsedAlignment)) {
      return response({ error: 'Gemini output is not an array.', status: 'failed' }, 502)
    }

    return response({
      success: true,
      source_url: source.source_url,
      source_platform: source.source_platform,
      source_id: source.source_id,
      raw_alignment: parsedAlignment,
      detected_duration: null,
    })
  } catch (err: any) {
    console.error('align-lyrics Edge Function unexpected error:', err)
    return response({ error: err.message || 'Internal server error during lyrics alignment.' }, 500)
  }
})

