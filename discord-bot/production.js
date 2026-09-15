import { createServer } from 'node:http'
import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import ffmpegPath from 'ffmpeg-static'

export async function checkRuntime() {
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major < 22 || (major === 22 && minor < 12)) throw new Error('Discord bot requires Node.js >=22.12.0.')
  if (!ffmpegPath) throw new Error('No ffmpeg-static binary for this platform.')
  try { await access(ffmpegPath, constants.X_OK) }
  catch { throw new Error('FFmpeg unavailable or not executable. Install dependencies on the target host with ffmpeg-static install scripts enabled.') }
}

export function setupHealth(client, voice) {
  let commands = false, announced = false, server, timer
  const snapshot = () => ({ status: client.isReady() ? 'ok' : 'degraded', discord: client.isReady(), commands, musicLibrary: voice.queue.state.tracks.length > 0 })
  const announce = () => {
    const status = snapshot()
    if (announced || !status.discord || !status.commands || !status.musicLibrary) return
    announced = true
    console.log('========================================\nSOUNDVERSE BOT PRODUCTION\n========================================\nDiscord: CONNECTED\nCommands: READY\nMusic Library: READY\nVoice Engine: READY\nEnvironment: PRODUCTION READY\n========================================')
  }
  if (process.env.PORT || process.env.DISCORD_HEALTH_ENABLED === 'true') {
    const port = Number(process.env.PORT || 3000)
    if (!Number.isInteger(port) || port < 1 || port > 65535) console.error('[SOUNDVERSE] Health server disabled: invalid PORT.')
    else {
      server = createServer((req, res) => {
        res.setHeader('Cache-Control', 'no-store')
        if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
        if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Soundverse Discord Bot is running'); return }
        if (req.url === '/health') {
          const status = snapshot()
          res.writeHead(status.discord ? 200 : 503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(status)); return
        }
        res.writeHead(404); res.end()
      })
      server.requestTimeout = 5000
      server.headersTimeout = 5000
      server.on('error', () => console.error('[SOUNDVERSE] Health server unavailable; check PORT and binding permissions. Bot continues running.'))
      server.listen(port, '0.0.0.0', () => console.log(`[SOUNDVERSE] Health server listening on port ${port}`))
    }
  }
  timer = setInterval(announce, 5000)
  timer.unref()
  return {
    commandsReady(value) { commands = value; announce() },
    snapshot,
    stop() {
      clearInterval(timer)
      server?.close()
      server?.closeAllConnections()
    },
  }
}

export function installProcessHandlers(client, voice, health, processHandle = process) {
  let stopping = false
  const shutdown = async (exitCode = 0) => {
    if (stopping) return
    stopping = true
    console.log('[SOUNDVERSE] Shutting down...')
    const deadline = setTimeout(() => processHandle.exit(1), 8000)
    deadline.unref()
    for (const cleanup of [() => health.stop(), () => voice.stop(), () => client.destroy()]) {
      try { await cleanup() }
      catch { exitCode = 1; console.error('[SOUNDVERSE] Resource cleanup failed.') }
    }
    clearTimeout(deadline)
    processHandle.exit(exitCode)
  }
  for (const signal of ['SIGINT', 'SIGTERM']) processHandle.once(signal, () => { void shutdown() })
  for (const event of ['unhandledRejection', 'uncaughtException']) {
    processHandle.on(event, () => {
      // Never dump exception objects: network errors may contain credentials/URLs.
      console.error(`[SOUNDVERSE] Fatal ${event}; shutting down for supervisor recovery.`)
      void shutdown(1)
    })
  }
  return { shutdown, get stopping() { return stopping } }
}
