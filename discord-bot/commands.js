import { Events, MessageFlags, escapeMarkdown } from 'discord.js'
import { commandDefinitions, logCommandError } from './commandRegistry.js'
import { safeTitle } from './music-source.js'

const supported = new Set(commandDefinitions.map(command => command.name))
const title = track => escapeMarkdown(safeTitle(track?.title || 'Chưa có bài đang phát').slice(0, 120))
const mode = state => state.repeatAll ? 'REPEAT ALL' : 'REPEAT ONE'

export async function handleCommand(interaction, voice) {
  if (!interaction.isChatInputCommand() || !supported.has(interaction.commandName)) return
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const reply = content => interaction.editReply({ content, allowedMentions: { parse: [] } })
    const guild = interaction.guild
    let channelId = guild?.voiceStates.cache.get(interaction.user.id)?.channelId
    if (!guild || !channelId) return await reply('❌ Bạn cần vào Voice Channel của bot trước.')
    if (!voice.channelId(guild.id) && interaction.commandName === 'play') {
      const channel = guild.channels.cache.get(channelId)
      if (!channel || !await voice.joinForCommand(channel)) return await reply('❌ Chưa thể kết nối Voice. Kiểm tra channel và quyền ViewChannel, Connect, Speak của bot.')
    }
    // Recheck after any awaited join: the user may have moved in the meantime.
    channelId = guild.voiceStates.cache.get(interaction.user.id)?.channelId
    if (!channelId || voice.channelId(guild.id) !== channelId) return await reply('❌ Bạn cần vào Voice Channel của bot trước.')
    const queue = voice.queue
    const state = queue.state
    switch (interaction.commandName) {
      case 'nowplaying':
        return await reply(state.currentTrack ? `🎵 SOUNDVERSE NOW PLAYING\n\n${title(state.currentTrack)}\nTrack: ${state.currentIndex + 1}/${state.tracks.length}\nMode: ${mode(state)}\nShuffle: ${state.shuffle ? 'ON' : 'OFF'}\nStatus: ${state.isPaused ? 'PAUSED' : state.isPlaying ? 'PLAYING' : 'IDLE / LOADING'}` : '🎵 Chưa có bài đang phát. Dùng /play để bắt đầu.')
      case 'pause':
        return await reply(queue.pause() ? `⏸️ Đã tạm dừng\n🎵 ${title(queue.state.currentTrack)}` : '⏸️ Chưa có audio đang phát để tạm dừng.')
      case 'resume':
        return await reply(queue.resume() ? `▶️ Tiếp tục phát\n🎵 ${title(queue.state.currentTrack)}` : '▶️ Không có audio đang tạm dừng. Dùng /play nếu Radio đã dừng.')
      case 'play': {
        const result = queue.play()
        return await reply(`${result === 'playing' ? '▶️ Soundverse Radio đang phát' : result === 'resumed' ? '▶️ Tiếp tục phát' : result === 'disconnected' ? '❌ Bot chưa kết nối Voice' : '▶️ Đang chuẩn bị Soundverse Radio'}\n🎵 ${title(queue.state.currentTrack)}`)
      }
      case 'next':
      case 'previous': {
        const track = interaction.commandName === 'next' ? queue.next() : queue.previous()
        return await reply(track ? `${interaction.commandName === 'next' ? '⏭️ Đã chọn bài kế tiếp' : '⏮️ Bài trước'}\n🎵 ${title(track)}` : '❌ Queue chưa sẵn sàng. Dùng /play để bắt đầu.')
      }
      case 'shuffle':
        return await reply(queue.toggleShuffle() ? '🔀 Shuffle: ON' : '➡️ Shuffle: OFF')
      case 'loop':
        return await reply(`🔁 Loop: ${queue.toggleLoop() ? 'REPEAT ALL' : 'REPEAT ONE'}`)
      case 'queue': {
        if (!state.currentTrack) return await reply('🎶 Queue đang trống. Dùng /play để bắt đầu.')
        const upcoming = queue.upcoming().map(track => `${state.tracks.findIndex(item => item.id === track.id) + 1}. ${title(track)}`)
        return await reply(`🎶 SOUNDVERSE QUEUE\n\n▶️ ${state.currentIndex + 1}. ${title(state.currentTrack)}\n${upcoming.join('\n')}\nMode: ${mode(state)} | Shuffle: ${state.shuffle ? 'ON' : 'OFF'}${state.shuffle && !upcoming.length ? '\nCuối vòng shuffle; lượt tiếp theo sẽ refresh thư viện.' : ''}`)
      }
    }
  } catch (error) {
    logCommandError(`/${interaction.commandName} failed`, error)
    try {
      const response = { content: '❌ Không thể thực hiện lệnh.', allowedMentions: { parse: [] } }
      if (interaction.deferred || interaction.replied) await interaction.editReply(response)
      else await interaction.reply({ ...response, flags: MessageFlags.Ephemeral })
    } catch (replyError) { logCommandError('Command error response failed', replyError) }
  }
}

export function setupCommands(client, voice) {
  client.on(Events.InteractionCreate, interaction => { void handleCommand(interaction, voice) })
}
