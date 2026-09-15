import { REST, Routes, SlashCommandBuilder } from 'discord.js'

export const commandDefinitions = [
  ['play', 'Bắt đầu hoặc tiếp tục Soundverse Radio'],
  ['pause', 'Tạm dừng bài đang phát'],
  ['resume', 'Tiếp tục bài đang tạm dừng'],
  ['next', 'Chuyển sang bài kế tiếp'],
  ['previous', 'Chuyển về bài trước'],
  ['nowplaying', 'Xem bài đang phát'],
  ['shuffle', 'Bật hoặc tắt phát ngẫu nhiên'],
  ['loop', 'Chuyển giữa Repeat All và Repeat One'],
  ['queue', 'Xem bài hiện tại và tối đa 5 bài tiếp theo'],
].map(([name, description]) => new SlashCommandBuilder().setName(name).setDescription(description).toJSON())

export function logCommandError(context, error) {
  const code = Number(error?.code) || 0
  const status = Number(error?.status) || 0
  const reason = ({ 50001: 'Missing access: check guild installation and application ID.', 50013: 'Missing permissions.', 10062: 'Interaction expired.', 40060: 'Interaction already acknowledged.', 10002: 'Unknown application.' })[code] || 'Check Discord connectivity, app configuration, and interaction state.'
  console.error(`[SOUNDVERSE] ${context} | Discord code: ${code} | HTTP: ${status} | ${reason}`)
}

export async function registerCommands(client) {
  const applicationId = process.env.DISCORD_CLIENT_ID?.trim() || client.application.id
  const selectedGuild = process.env.DISCORD_GUILD_ID?.trim()
  const guildIds = selectedGuild ? [selectedGuild] : [...client.guilds.cache.keys()]
  if (!/^\d+$/.test(applicationId) || guildIds.some(id => !/^\d+$/.test(id))) throw new Error('Invalid Discord ID configuration')
  if (!guildIds.length) { console.warn('[SOUNDVERSE] Commands: no guild available for registration.'); return false }
  const rest = new REST({ version: '10', timeout: 15_000, retries: 2 }).setToken(process.env.DISCORD_TOKEN)
  for (const guildId of guildIds) {
    if (!client.guilds.cache.has(guildId)) throw new Error('Configured guild is not joined by this bot')
    // Upsert only our nine names; preserve any other application commands.
    for (const body of commandDefinitions) {
      await rest.post(Routes.applicationGuildCommands(applicationId, guildId), { body })
    }
  }
  console.log(['========================================', 'SOUNDVERSE DISCORD COMMANDS', '========================================', ...commandDefinitions.map(command => `/${command.name}`), `Guilds: ${guildIds.length}`, 'Status: READY', '========================================'].join('\n'))
  return true
}
