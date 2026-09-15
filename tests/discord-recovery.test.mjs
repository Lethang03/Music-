import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { VoiceConnectionStatus } from '@discordjs/voice'

test('voice recovery waits for library signalling then Ready, and rejects unrecoverable disconnect', async () => {
  let broken = false
  const calls = []
  mock.module('@discordjs/voice', { namedExports: {
    VoiceConnectionStatus,
    entersState: async (connection, status, timeout) => { calls.push([status, timeout]); if (broken) throw new Error('timeout'); return connection },
  } })
  const { recoverVoice } = await import('../discord-bot/voice-recovery.js')
  await recoverVoice({})
  assert.ok(calls.some(([status, timeout]) => status === VoiceConnectionStatus.Ready && timeout === 20000))
  broken = true
  await assert.rejects(recoverVoice({}))
  mock.restoreAll()
})
