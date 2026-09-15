import { ChannelType, Events, PermissionFlagsBits } from 'discord.js'
import { setupMusicQueue } from './queue.js'
import { recoverVoice } from './voice-recovery.js'
import {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice'

export function setupVoice(client) {
  const musicQueue = setupMusicQueue()
  let joining = false
  let stopped = false
  let activeConnection
  const humanCount = (channel) => channel.members.filter((member) => !member.user.bot).size
  const hasConnection = () => [...client.guilds.cache.values()].some((guild) => getVoiceConnection(guild.id))

  const destroy = (connection) => {
    if (connection && activeConnection === connection) musicQueue.stop()
    if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy()
    if (activeConnection === connection) activeConnection = undefined
  }

  const tryJoin = async (channel) => {
    if (stopped || joining || hasConnection()) return false
    if (!channel || channel.type !== ChannelType.GuildVoice || channel.id === channel.guild.afkChannelId) return false
    if (!humanCount(channel)) return false

    joining = true
    let connection
    const location = `Server: ${channel.guild.name} | Channel: ${channel.name}`
    try {
      const member = channel.guild.members.me ?? await channel.guild.members.fetchMe()
      const permissions = channel.permissionsFor(member)
      const missing = ['ViewChannel', 'Connect', 'Speak'].filter((name) => !permissions?.has(PermissionFlagsBits[name]))
      if (missing.length) {
        console.warn(`Voice: Missing permissions: ${missing.join(', ')} | ${location}`)
        return false
      }
      if (stopped || hasConnection() || !humanCount(channel)) return false

      console.log(`Voice: Joining | ${location}`)
      connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: true,
      })
      activeConnection = connection
      let recovering = false
      connection.on('error', () => {
        console.error(`Voice: Connection error; disconnecting. Check voice permissions and network. | ${location}`)
        destroy(connection)
      })
      connection.on(VoiceConnectionStatus.Disconnected, () => {
        if (recovering || stopped) return
        recovering = true
        console.warn(`Voice: Disconnected | ${location}`)
        void recoverVoice(connection).then(() => {
          if (stopped || activeConnection !== connection) return
          console.log(`Voice: Recovered | ${location}`)
          if (!musicQueue.state.isPlaying && !musicQueue.state.isPaused) musicQueue.play()
        }).catch(() => {
          if (stopped || activeConnection !== connection) return
          console.warn(`Voice: Recovery timed out; waiting for listener or /play. | ${location}`)
          destroy(connection)
        }).finally(() => { recovering = false })
      })
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000)
      if (stopped || connection.state.status !== VoiceConnectionStatus.Ready) return false
      console.log([
        '========================================',
        'SOUNDVERSE VOICE',
        '========================================',
        'Status: CONNECTED',
        `Server: ${channel.guild.name}`,
        `Channel: ${channel.name}`,
        `Listeners: ${humanCount(channel)}`,
        'Audio: Preparing Soundverse Radio',
        '========================================',
      ].join('\n'))
      musicQueue.start(connection)
      return true
    } catch {
      // Do not log SDK error objects, which may contain credentials.
      if (!stopped) console.error(`Voice: Could not connect within 30 seconds or voice setup failed. Check permissions and network. | ${location}`)
      destroy(connection)
      return false
    } finally {
      joining = false
    }
  }

  const onVoiceStateUpdate = (oldState, newState) => {
    if (!client.isReady() || !newState.member || newState.member.user.bot) return
    if (oldState.channelId === newState.channelId) return
    void tryJoin(newState.channel)
  }
  client.on(Events.VoiceStateUpdate, onVoiceStateUpdate)

  return {
    get queue() { return musicQueue },
    channelId(guildId) {
      return activeConnection?.joinConfig.guildId === guildId ? activeConnection.joinConfig.channelId : null
    },
    async joinForCommand(channel) {
      if (activeConnection) return this.channelId(channel.guild.id) === channel.id
      return tryJoin(channel)
    },
    async start() {
      for (const guild of client.guilds.cache.values()) {
        for (const channel of guild.channels.cache.values()) {
          if (stopped || hasConnection()) return
          if (await tryJoin(channel)) return
        }
      }
      if (!stopped && !joining && !hasConnection()) console.log('Voice: Waiting for listener...')
    },
    stop() {
      stopped = true
      musicQueue.stop()
      client.off(Events.VoiceStateUpdate, onVoiceStateUpdate)
      destroy(activeConnection)
    },
  }
}
