import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

test('bounded library backoff and abort', async () => {
  const waits = []
  mock.module('node:timers/promises', { namedExports: { setTimeout: async ms => waits.push(ms) } })
  const { retryMusicLibrary } = await import('../discord-bot/retry.js')
  let attempts = 0
  const signal = new AbortController().signal
  assert.deepEqual(await retryMusicLibrary(async () => { if (++attempts < 3) throw new Error(); return ['track'] }, signal), ['track'])
  assert.deepEqual(waits, [5000, 15000])
  attempts = 0; waits.length = 0
  await assert.rejects(retryMusicLibrary(async () => { attempts++; throw new Error() }, signal))
  assert.equal(attempts, 4); assert.deepEqual(waits, [5000, 15000, 30000])
  const controller = new AbortController(); controller.abort()
  await assert.rejects(retryMusicLibrary(async () => assert.fail('must not load'), controller.signal))
  mock.restoreAll()
})

test('fatal errors and signals cleanup once, with safe logs and correct exit status', async () => {
  const { installProcessHandlers, setupHealth, checkRuntime } = await import('../discord-bot/production.js')
  await checkRuntime()
  for (const [event, exitCode] of [['SIGTERM', 0], ['SIGINT', 0], ['unhandledRejection', 1], ['uncaughtException', 1]]) {
    const fake = new EventEmitter(), cleaned = [], exits = [], logs = []
    fake.exit = code => exits.push(code)
    const log = mock.method(console, 'error', (...args) => logs.push(args.join(' ')))
    installProcessHandlers({ destroy: async () => cleaned.push('client') }, { stop: () => cleaned.push('voice') }, { stop: () => cleaned.push('health') }, fake)
    fake.emit(event, new Error('DO_NOT_LOG_SECRET'))
    fake.emit('SIGTERM')
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(cleaned, ['health', 'voice', 'client']); assert.deepEqual(exits, [exitCode])
    assert.ok(!logs.join('').includes('DO_NOT_LOG_SECRET'))
    log.mock.restore()
  }
  const oldPort = process.env.PORT, oldEnabled = process.env.DISCORD_HEALTH_ENABLED
  delete process.env.PORT; process.env.DISCORD_HEALTH_ENABLED = 'false'
  let ready = false
  const health = setupHealth({ isReady: () => ready }, { queue: { state: { tracks: [] } } })
  assert.equal(health.snapshot().status, 'degraded')
  ready = true; health.commandsReady(true)
  assert.deepEqual(health.snapshot(), { status: 'ok', discord: true, commands: true, musicLibrary: false })
  health.stop()
  if (oldPort === undefined) delete process.env.PORT; else process.env.PORT = oldPort
  if (oldEnabled === undefined) delete process.env.DISCORD_HEALTH_ENABLED; else process.env.DISCORD_HEALTH_ENABLED = oldEnabled
})
