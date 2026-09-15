import { Client, Events, GatewayIntentBits } from 'discord.js'
import { botName } from './config.js'
import { setupVoice } from './voice.js'
import { setupCommands } from './commands.js'
import { registerCommands, logCommandError } from './commandRegistry.js'
import { checkRuntime, setupHealth, installProcessHandlers } from './production.js'

if (!process.env.DISCORD_TOKEN?.trim()) {
  console.error('Missing DISCORD_TOKEN')
  process.exitCode = 1
} else {
  try { await checkRuntime() }
  catch (error) { console.error(`[SOUNDVERSE] ${error.message}`); process.exit(1) }
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  })
  const voice = setupVoice(client)
  const health = setupHealth(client, voice)
  const lifecycle = installProcessHandlers(client, voice, health)
  setupCommands(client, voice)

  client.once(Events.ClientReady, (readyClient) => {
    console.log([
      '========================================',
      'SOUNDVERSE DISCORD BOT',
      '========================================',
      'Status: ONLINE',
      `Bot: ${botName}`,
      `Account: ${readyClient.user.tag}`,
      'Discord: Connected',
      'Voice Engine: Ready for next step',
      '========================================',
    ].join('\n'))
    void registerCommands(readyClient).then(ready => health.commandsReady(ready)).catch(error => logCommandError('Command registration failed', error))
    void voice.start().catch(() => {
      console.error('Voice: Channel discovery failed. Waiting for listener...')
    })
  })

  // Keep SDK error objects out of logs so credentials cannot be exposed.
  client.on(Events.Error, () => {
    console.error('Discord connection error. Check network connectivity and bot settings.')
  })
  client.on(Events.ShardReconnecting, () => console.warn('[SOUNDVERSE] Discord gateway reconnecting (managed by discord.js).'))
  client.on(Events.ShardResume, () => console.log('[SOUNDVERSE] Discord gateway resumed.'))

  try {
    await client.login(process.env.DISCORD_TOKEN)
  } catch {
    if (!lifecycle.stopping) {
      console.error('Discord login failed. Check DISCORD_TOKEN, bot settings, and network connectivity.')
      await lifecycle.shutdown(1)
    }
  }
}
