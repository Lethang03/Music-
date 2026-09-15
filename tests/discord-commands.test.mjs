import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MessageFlags } from 'discord.js'
import { handleCommand } from '../discord-bot/commands.js'

test('slash permissions, routing, ephemeral replies, bounded queue, and error handling', async () => {
  const track = { id: 'A', title: '*'.repeat(180) + ' https://example.invalid?token=SECRET' }
  const state = { currentTrack: track, tracks: [track], currentIndex: 0, isPlaying: true, isPaused: false, repeatAll: true, shuffle: false }
  let calls = 0
  const queue = {
    state, pause: () => { calls++; return true }, resume: () => { calls++; return true },
    play: () => { calls++; return 'playing' }, next: () => { calls++; return track }, previous: () => { calls++; return track },
    toggleShuffle: () => { calls++; return true }, toggleLoop: () => { calls++; return false }, upcoming: () => Array(5).fill(track),
  }
  let botChannel = 'voice'
  const voice = { queue, channelId: () => botChannel, joinForCommand: async () => { botChannel = 'voice'; return true } }
  const make = (name, channelId = 'voice') => {
    const responses = []
    return {
      commandName: name, user: { id: 'user' }, responses,
      guild: { id: 'guild', voiceStates: { cache: new Map([['user', { channelId }]]) }, channels: { cache: new Map([['voice', { id: 'voice' }]]) } },
      isChatInputCommand: () => true,
      async deferReply(options) { assert.equal(options.flags, MessageFlags.Ephemeral); this.deferred = true },
      async editReply(options) { responses.push(options); assert.deepEqual(options.allowedMentions, { parse: [] }); assert.ok(options.content.length <= 2000) },
    }
  }
  for (const channelId of [null, 'other']) {
    const interaction = make('next', channelId)
    await handleCommand(interaction, voice)
    assert.match(interaction.responses[0].content, /Bạn cần vào Voice Channel/)
  }
  assert.equal(calls, 0)
  for (const name of ['play', 'pause', 'resume', 'next', 'previous', 'nowplaying', 'shuffle', 'loop', 'queue']) {
    const interaction = make(name)
    await handleCommand(interaction, voice)
    assert.equal(interaction.responses.length, 1)
    assert.ok(!interaction.responses[0].content.includes('SECRET'))
  }
  assert.equal(calls, 7)
  botChannel = null
  const start = make('play')
  await handleCommand(start, voice)
  assert.equal(botChannel, 'voice')
  queue.next = () => { throw new Error('credential=DO_NOT_PRINT') }
  const failure = make('next')
  await handleCommand(failure, voice)
  assert.equal(failure.responses[0].content, '❌ Không thể thực hiện lệnh.')
  const button = make('next'); button.isChatInputCommand = () => false
  await handleCommand(button, voice); assert.equal(button.responses.length, 0)
})
