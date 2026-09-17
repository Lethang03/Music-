import { test, expect } from '@playwright/test'
import { setup, playFirst, playerBar } from './fixtures'

async function captureSession(page) {
  await page.addInitScript(() => {
    window.sessionActions = {}
    window.sessionRegistrations = []
    const native = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession)
    navigator.mediaSession.setActionHandler = (name, handler) => {
      window.sessionActions[name] = handler
      window.sessionRegistrations.push({ name, enabled: !!handler })
      native(name, handler)
    }
  })
}

for (const kind of ['music', 'podcast']) {
  test(`${kind}: media commands switch and play synchronously with stable handlers`, async ({ page }) => {
    const { podcastId, errors } = await setup(page, { seconds: 30 })
    await captureSession(page)
    if (kind === 'music') await playFirst(page)
    else {
      await page.goto(`/podcasts/${podcastId}`)
      await page.locator('.v2-ep-row').filter({ hasText: 'Episode 1' }).click()
      await expect(playerBar(page).getByTitle('Pause', { exact: true })).toBeVisible()
    }
    const prefix = kind === 'music' ? 'Track' : 'Episode'
    const snapshot = await page.evaluate(() => {
      const audio = window.testAudio.find(a => a.src)
      window.originalPlayer = audio
      window.registrationCount = window.sessionRegistrations.length
      window.playCalls = []
      const play = audio.play.bind(audio)
      audio.play = () => { window.playCalls.push(audio.src); return play() }
      // Synthetic lifecycle only: this does not emulate an OS-locked phone.
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('pagehide'))
      window.sessionActions.nexttrack()
      return { title: navigator.mediaSession.metadata.title, src: audio.src, calls: window.playCalls.length }
    })
    expect(snapshot.title).toBe(`${prefix} 2`)
    expect(snapshot.src).toContain(kind === 'music' ? '/2.wav' : '/episode2.wav')
    expect(snapshot.calls).toBe(1)
    await expect(playerBar(page)).toContainText(`${prefix} 2`)
    await expect.poll(() => page.evaluate(() => window.originalPlayer.currentTime)).toBeGreaterThan(0)
    await page.evaluate(() => { window.sessionActions.pause(); window.sessionActions.previoustrack() })
    await expect(playerBar(page)).toContainText(`${prefix} 1`)
    await expect.poll(() => page.evaluate(() => navigator.mediaSession.playbackState)).toBe('playing')
    await page.evaluate(() => window.sessionActions.pause())
    await expect.poll(() => page.evaluate(() => navigator.mediaSession.playbackState)).toBe('paused')
    await page.evaluate(() => window.sessionActions.play())
    await expect.poll(() => page.evaluate(() => navigator.mediaSession.playbackState)).toBe('playing')
    await page.evaluate(() => window.sessionActions.seekto({ seekTime: 29.8 }))
    await expect(playerBar(page)).toContainText(`${prefix} 2`)
    await expect.poll(() => page.evaluate(() => window.originalPlayer.currentTime)).toBeGreaterThan(0)
    expect(await page.evaluate(() => ({ same: window.testAudio.find(a => a.src) === window.originalPlayer, registrations: window.sessionRegistrations.length === window.registrationCount, calls: window.playCalls.length }))).toEqual({ same: true, registrations: true, calls: 4 })
    expect(errors).toEqual([])
  })
}

test('rapid next ignores old rejection and stale ended; latest rejection is recoverable', async ({ page }) => {
  await setup(page, { seconds: 30 })
  await captureSession(page)
  await playFirst(page)
  await page.evaluate(() => {
    const audio = window.testAudio.find(a => a.src)
    const play = audio.play.bind(audio)
    let first = true
    audio.play = () => {
      if (first) { first = false; return new Promise((resolve, reject) => { window.rejectOld = reject }) }
      return play()
    }
    window.sessionActions.nexttrack()
    window.sessionActions.nexttrack()
    audio.dispatchEvent(new Event('ended'))
    window.rejectOld(new DOMException('old source', 'AbortError'))
  })
  await expect(playerBar(page)).toContainText('Track 3')
  await expect(playerBar(page).getByTitle('Pause', { exact: true })).toBeVisible()
  await expect(playerBar(page).getByRole('alert')).toHaveCount(0)
  await page.evaluate(() => {
    const audio = window.testAudio.find(a => a.src)
    window.sessionActions.pause()
    audio.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'))
    window.sessionActions.play()
  })
  await expect(playerBar(page).getByRole('alert')).toContainText('Playback was blocked')
  expect(await page.evaluate(() => navigator.mediaSession.playbackState)).toBe('paused')
})

test('empty queue clears session metadata and playback state', async ({ page }) => {
  await setup(page)
  await captureSession(page)
  await playFirst(page)
  await page.evaluate(() => window.dispatchEvent(new Event('auth_cleared')))
  expect(await page.evaluate(() => ({ metadata: navigator.mediaSession.metadata, state: navigator.mediaSession.playbackState }))).toEqual({ metadata: null, state: 'none' })
})
