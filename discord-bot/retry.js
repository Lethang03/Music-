import { setTimeout as delay } from 'node:timers/promises'

export async function retryMusicLibrary(load, signal) {
  const backoff = [5000, 15000, 30000]
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted()
    try { return await load(signal) }
    catch (error) {
      if (signal.aborted) throw error
      console.warn('[SOUNDVERSE] Music Library unavailable')
      if (attempt === backoff.length) throw error
      console.log(`[SOUNDVERSE] Retrying Music Library in ${backoff[attempt] / 1000}s (${attempt + 1}/3)`)
      await delay(backoff[attempt], undefined, { signal })
    }
  }
}
