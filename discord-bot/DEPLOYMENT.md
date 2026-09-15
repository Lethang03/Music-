# Soundverse Discord bot — production preparation

No host deployment is performed by this change.

## Install and start

Use a persistent Linux Node.js 24 LTS process (minimum Node 22.12).
From the repository root:

```sh
npm ci --omit=dev
npm run start:discord
```

Install dependencies on the destination OS; do not copy Windows node_modules.
Allow ffmpeg-static's install script and its binary download. The bot uses
discord-bot plus the existing src/lib/supabase.js and src/lib/storage.js helpers,
so retain those source files. The website has its own unchanged build command.

## Environment

Required: DISCORD_TOKEN, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
Use the existing public/publishable Supabase key, not a service-role key.
Keep DISCORD_TOKEN in the bot service environment only, never in VITE_* variables.

Optional: DISCORD_CLIENT_ID (auto-detected), DISCORD_GUILD_ID (otherwise joined
guilds), DISCORD_HEALTH_ENABLED=true, PORT (default 3000 when health is enabled),
FFMPEG_BIN (optional executable override; normally leave blank).

## Host and audio

Provide outbound HTTPS, persistent Discord WebSockets, UDP voice networking,
DNS, environment variables, and a supervisor with restart backoff/rate limits.
Run one instance for this bot token. Start with 1 GB RAM and monitor real use;
this is a sizing suggestion, not a measured minimum.

ffmpeg-static supplies a platform binary with libopus. The existing pipeline
streams HTTP audio through FFmpeg into Ogg Opus and @discordjs/voice, using
transitive prism-media. No separate opusscript/@discordjs/opus or full-library
disk download is required. If the platform cannot use the packaged binary,
install an executable FFmpeg with libopus and set FFMPEG_BIN.

## Health and recovery

HTTP is disabled unless PORT is set or DISCORD_HEALTH_ENABLED=true. Bind address:
0.0.0.0. GET / is process liveness; GET /health reports Discord connectivity and
command/library readiness (200 connected, 503 disconnected). No credentials or
track URLs are returned. Bind failure is logged without stopping the bot.

The production READY banner is emitted after commands and the first music
library load succeed; with no voice listener, the library remains pending.
Health is not proof that a listener can hear audio.

Library startup retries after 5, 15, and 30 seconds, then stays alive awaiting
/play. End-of-cycle refresh failure retains the previous catalog.
discord.js handles gateway recovery. Voice disconnect waits for adapter recovery
and Ready; on timeout, cleanup allows a later human voice join or /play to rejoin.
Fatal process errors safely exit 1 after cleanup; the host supervisor owns restarts.
SIGINT/SIGTERM clean resources, with an 8-second forced-exit deadline.

## Security and verification

The previously tracked root .env has been removed from the Git index, not from
disk. Local Discord and worker service-role credentials remain ignored.
The source scan reports paths/categories only; it excludes vendor/cache folders
and does not audit all Git history. Never re-add .env with git add -f.

```sh
node --experimental-test-module-mocks --test tests/discord-*.test.mjs
node audit/check-discord-secrets.mjs
npm run build
```

Tests/build require dev dependencies (use npm ci instead of --omit=dev).
Linux execution, long-duration reliability and real network outages must still
be verified on the chosen host. No DNS, web deployment, credential rotation,
Git push, or automatic host provisioning is included.
