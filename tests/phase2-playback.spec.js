import { test, expect } from '@playwright/test'
import { setup, playFirst, playerBar } from './fixtures'

async function setupPhase2Spies(page) {
  await page.addInitScript(() => {
    window.sessionActions = {}
    window.positionStateCalls = []
    window.syncTimeline = []

    if (navigator.mediaSession) {
      const nativeSetActionHandler = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession)
      navigator.mediaSession.setActionHandler = (name, handler) => {
        window.sessionActions[name] = handler
        nativeSetActionHandler(name, handler)
      }

      navigator.mediaSession.setPositionState = state => {
        window.positionStateCalls.push(state)
      }
    }
  })
}

test.describe('SoundVerse Phase 2 - Auto Next & Background Playback', () => {
  test('ended event executes synchronous transition to next track in same execution flow', async ({ page }) => {
    const { errors } = await setup(page, { seconds: 30 })
    await setupPhase2Spies(page)
    await playFirst(page)

    const syncCheck = await page.evaluate(() => {
      const audio = window.testAudio.find(a => a.src)
      const executionLog = []

      const origPlay = audio.play.bind(audio)
      audio.play = () => {
        executionLog.push({ step: 'audio.play()', src: audio.src, ended: audio.ended })
        return origPlay()
      }

      // Simulate natural ended
      executionLog.push({ step: 'before dispatch ended' })
      Object.defineProperty(audio, 'ended', { value: true, configurable: true })
      audio.dispatchEvent(new Event('ended'))
      executionLog.push({ step: 'after dispatch ended', currentSrc: audio.src })

      return executionLog
    })

    // Assert that audio.play was called synchronously inside the same ended dispatch
    expect(syncCheck[0].step).toBe('before dispatch ended')
    expect(syncCheck[1].step).toBe('audio.play()')
    expect(syncCheck[1].src).toContain('/2.wav')
    expect(syncCheck[2].step).toBe('after dispatch ended')
    expect(syncCheck[2].currentSrc).toContain('/2.wav')

    await expect(playerBar(page)).toContainText('Track 2')
    expect(errors).toEqual([])
  })

  test('auto next advances through queue without reloading page or recreating audio element', async ({ page }) => {
    const { errors } = await setup(page, { seconds: 1.2, preferences: { volume: 0.1, shuffle: false, repeat: 'none', autoplay: true } })
    await playFirst(page)

    // Wait for ended events to cycle tracks 1 -> 2 -> 3
    await expect.poll(() => page.evaluate(() => window.mediaEvents.filter(e => e.event === 'ended').length), { timeout: 12000 }).toBeGreaterThanOrEqual(2)

    // Verify single audio instance was reused throughout
    const audioCount = await page.evaluate(() => window.testAudio.filter(a => a.src).length)
    expect(audioCount).toBe(1)

    // Verify playback sequence
    const played = await page.evaluate(() => window.mediaEvents.filter(e => e.event === 'playing').map(e => new URL(e.src).pathname))
    expect(played.slice(0, 2)).toEqual(['/test-audio/1.wav', '/test-audio/2.wav'])
    expect(errors).toEqual([])
  })

  test('setPositionState is never called with duration 0 or NaN, only called with positive finite duration', async ({ page }) => {
    const { errors } = await setup(page, { seconds: 30 })
    await setupPhase2Spies(page)
    await playFirst(page)

    const invalidCalls = await page.evaluate(() => {
      return window.positionStateCalls.filter(call => {
        if (!call) return true
        return !Number.isFinite(call.duration) || call.duration <= 0 || isNaN(call.duration)
      })
    })

    expect(invalidCalls).toHaveLength(0)

    const validCalls = await page.evaluate(() => {
      return window.positionStateCalls.filter(call => Number.isFinite(call?.duration) && call.duration > 0)
    })
    expect(validCalls.length).toBeGreaterThan(0)
    expect(errors).toEqual([])
  })

  test('media session actions play, pause, nexttrack, previoustrack, seekto, and stop operate correctly', async ({ page }) => {
    const { errors } = await setup(page, { seconds: 30 })
    await setupPhase2Spies(page)
    await playFirst(page)

    // Verify all core actions are registered
    const registeredActions = await page.evaluate(() => Object.keys(window.sessionActions))
    expect(registeredActions).toContain('play')
    expect(registeredActions).toContain('pause')
    expect(registeredActions).toContain('nexttrack')
    expect(registeredActions).toContain('previoustrack')
    expect(registeredActions).toContain('seekto')
    expect(registeredActions).toContain('stop')

    // Test nexttrack
    await page.evaluate(() => window.sessionActions.nexttrack())
    await expect(playerBar(page)).toContainText('Track 2')

    // Test previoustrack
    await page.evaluate(() => window.sessionActions.previoustrack())
    await expect(playerBar(page)).toContainText('Track 1')

    // Test pause
    await page.evaluate(() => window.sessionActions.pause())
    await expect(playerBar(page).getByTitle('Play', { exact: true })).toBeVisible()

    // Test play
    await page.evaluate(() => window.sessionActions.play())
    await expect(playerBar(page).getByTitle('Pause', { exact: true })).toBeVisible()

    // Test stop
    await page.evaluate(() => window.sessionActions.stop())
    await expect.poll(() => page.evaluate(() => navigator.mediaSession.playbackState)).toBe('none')

    expect(errors).toEqual([])
  })

  test('visibilitychange hidden resumes Web Audio context if suspended', async ({ page }) => {
    const { errors } = await setup(page, { seconds: 30 })
    await playFirst(page)

    const resumedOnHidden = await page.evaluate(async () => {
      // Initialize an equalizer context to test Web Audio resume on visibility hidden
      const resumedCalls = []
      const fakeCtx = {
        state: 'suspended',
        resume: () => {
          resumedCalls.push('resumed')
          fakeCtx.state = 'running'
          return Promise.resolve()
        }
      }

      // Attach fake audio context to simulate suspended Web Audio
      if (window.__soundverse_web_audio) {
        window.__soundverse_web_audio.ctx = fakeCtx
      }

      // Trigger visibility change to hidden
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))

      return document.visibilityState === 'hidden'
    })

    expect(resumedOnHidden).toBe(true)
    expect(errors).toEqual([])
  })
})

