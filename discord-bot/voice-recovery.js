import { entersState, VoiceConnectionStatus } from '@discordjs/voice'

export async function recoverVoice(connection) {
  // Let the voice adapter/gateway resume first; no custom reconnect loop.
  await Promise.race([
    entersState(connection, VoiceConnectionStatus.Signalling, 5000),
    entersState(connection, VoiceConnectionStatus.Connecting, 5000),
    entersState(connection, VoiceConnectionStatus.Ready, 5000),
  ])
  await entersState(connection, VoiceConnectionStatus.Ready, 20_000)
}
