import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
const temp = path.resolve('audit/tmp'); mkdirSync(temp, { recursive: true })
const env = { ...process.env, TEMP: temp, TMP: temp, SOUNDVERSE_EXTERNAL_SERVER: '1', VITE_SUPABASE_URL: 'https://soundverse-test.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_publishable_fixture' }
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '3100', '--strictPort'], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
let serverError = ''
server.stderr.on('data', data => { serverError += data })
let runner
const cleanup = () => { runner?.kill(); server.kill() }
process.on('SIGINT', () => { cleanup(); process.exit(130) })
try {
  let ready = false
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error(serverError || 'Test server exited')
    try { const r = await fetch('http://127.0.0.1:3100'); if (r.ok) { ready = true; break } } catch { /* Wait for startup. */ }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  if (!ready) throw new Error('Test server did not become ready')
  runner = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], { env, stdio: 'inherit', windowsHide: true })
  const code = await new Promise((resolve, reject) => { runner.on('error', reject); runner.on('exit', resolve) })
  process.exitCode = code ?? 1
} catch (err) { console.error(err.message); process.exitCode = 1 }
finally { cleanup() }
