import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import * as discord from 'discord.js'

test('guild registration upserts nine commands once without overwriting other commands', async () => {
  const requests = []
  mock.module('discord.js', { namedExports: { SlashCommandBuilder: discord.SlashCommandBuilder, Routes: discord.Routes, REST: class {
    setToken() { return this }
    async post(route, { body }) { requests.push({ route, body }) }
  } } })
  const previous = { client: process.env.DISCORD_CLIENT_ID, guild: process.env.DISCORD_GUILD_ID }
  process.env.DISCORD_CLIENT_ID = ''; process.env.DISCORD_GUILD_ID = '456'
  try {
    const { registerCommands } = await import('../discord-bot/commandRegistry.js')
    await registerCommands({ application: { id: '123' }, guilds: { cache: new Map([['456', {}]]) } })
    assert.equal(requests.length, 9)
    assert.deepEqual(requests.map(r => r.body.name), ['play', 'pause', 'resume', 'next', 'previous', 'nowplaying', 'shuffle', 'loop', 'queue'])
    assert.ok(requests.every(r => r.route === '/applications/123/guilds/456/commands'))
  } finally {
    for (const [key, value] of [['DISCORD_CLIENT_ID', previous.client], ['DISCORD_GUILD_ID', previous.guild]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value
    }
    mock.restoreAll()
  }
})
