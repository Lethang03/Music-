import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
const adb = (...args) => execFileSync('F:\\LDPlayer\\LDPlayer9\\adb.exe', ['-s', 'emulator-5554', ...args], { encoding: 'utf8' })
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const label = process.argv[2] || 'baseline'
const podcast = process.argv.includes('--podcast')
const out = `audit/ldplayer-${label}`
fs.mkdirSync(out, { recursive: true })
const records = []
function snapshot(step) {
  const media = adb('shell', 'dumpsys', 'media_session')
  const power = adb('shell', 'dumpsys', 'power')
  fs.writeFileSync(`${out}/${step}.txt`, media + '\n' + power.split('\n').filter(l => /mWakefulness=|Display Power: state=/.test(l)).join('\n'))
  const row = { step, metadata: media.split('\n').filter(l => /metadata:/.test(l)).map(l => l.trim()), state: media.split('\n').filter(l => /state=PlaybackState/.test(l)).map(l => l.trim()), screen: power.split('\n').filter(l => /mWakefulness=|Display Power: state=/.test(l)).map(l => l.trim()) }
  row.observedAt = Date.now()
  try { row.audio = JSON.parse(fs.readFileSync('audit/ldplayer-live.json', 'utf8')) } catch { /* No observation yet. */ }
  records.push(row); console.log(JSON.stringify(row)); fs.writeFileSync(`${out}/summary.json`, JSON.stringify(records, null, 2))
}
async function withPage(fn) {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
  const pages = browser.contexts().flatMap(c => c.pages()).filter(p => p.url().startsWith('http://127.0.0.1:3100'))
  let page
  for (const candidate of pages) if (await candidate.evaluate(() => document.visibilityState === 'visible')) { page = candidate; break }
  page ||= pages.at(-1)
  if (!page) throw new Error('Soundverse tab missing')
  // These localhost fixture tabs were all opened by this task; retain one owner.
  for (const other of pages) if (other !== page) await other.close()
  await page.bringToFront()
  await fn(page)
  await browser.close() // Disconnect debugger before HOME/POWER/media-key tests.
}
adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP')
adb('shell', 'wm', 'dismiss-keyguard')
adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'http://127.0.0.1:3100/music', 'com.android.chrome')
await wait(1500)
await withPage(async page => {
  await page.goto(podcast ? 'http://127.0.0.1:3100/podcasts/33333333-3333-4333-8333-333333333333' : 'http://127.0.0.1:3100/music')
  if (podcast) await page.locator('.v2-ep-row').filter({ hasText: 'Episode 1' }).click()
  else await page.locator('.v2-premium-card').filter({ hasText: 'Track 1' }).click()
  await page.locator('.v2-player-bar').getByTitle('Pause', { exact: true }).waitFor()
})
await wait(1000); snapshot('01-playing')
adb('shell', 'input', 'keyevent', 'KEYCODE_MEDIA_NEXT'); snapshot('02-foreground-next-immediate')
await wait(4000); snapshot('03-foreground-next-later')
adb('shell', 'input', 'keyevent', 'KEYCODE_HOME'); await wait(5000); snapshot('04-home')
adb('shell', 'input', 'keyevent', 'KEYCODE_MEDIA_NEXT'); snapshot('05-background-next-immediate')
await wait(4000); snapshot('06-background-next-later')
adb('shell', 'input', 'keyevent', 'KEYCODE_MEDIA_PREVIOUS'); await wait(300)
adb('shell', 'input', 'keyevent', 'KEYCODE_MEDIA_PREVIOUS'); snapshot('10-previous-immediate')
await wait(4000); snapshot('11-previous-later')
adb('shell', 'input', 'keyevent', 'KEYCODE_MEDIA_PLAY_PAUSE'); await wait(1000); snapshot('12-paused')
await wait(3000); snapshot('13-still-paused')
adb('shell', 'input', 'keyevent', 'KEYCODE_MEDIA_PLAY_PAUSE'); snapshot('14-resume-immediate')
await wait(4000); snapshot('15-resume-later')
adb('shell', 'input', 'keyevent', 'KEYCODE_POWER'); await wait(2000); snapshot('07-power-off')
adb('shell', 'input', 'keyevent', 'KEYCODE_MEDIA_NEXT'); snapshot('08-locked-next-immediate')
await wait(4000); snapshot('09-locked-next-later')
// Compare OS media-service dispatch against input injection while fully OFF.
adb('shell', 'media', 'dispatch', 'next'); snapshot('09b-locked-service-next-immediate')
await wait(4000); snapshot('09c-locked-service-next-later')
// Seek only during explicit foreground preparation, then detach and lock again.
adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'); adb('shell', 'wm', 'dismiss-keyguard')
adb('shell', 'am', 'start', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.LAUNCHER', 'com.android.chrome')
await wait(1000)
await withPage(async page => {
  await wait(1000)
  const audio = await page.evaluate(async () => { const a = window.testAudio.find(a => a.src); if (!a) return false; a.currentTime = a.duration - 20; await a.play(); return true })
  if (!audio) throw new Error('Missing live media element')
})
adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
adb('shell', 'input', 'keyevent', 'KEYCODE_POWER'); await wait(2000); snapshot('16-before-natural-end-locked')
await wait(25000); snapshot('17-auto-next')
await wait(4000); snapshot('18-auto-next-later')
fs.writeFileSync(`${out}/logcat.txt`, adb('shell', 'logcat', '-d', '-t', '150', 'chromium:W', 'MediaSessionService:D', '*:S'))
adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'); adb('shell', 'wm', 'dismiss-keyguard')
await withPage(async page => {
  const diagnostic = await page.evaluate(() => JSON.parse(localStorage.getItem('soundverse_playback_diagnostics') || '[]'))
  fs.writeFileSync(`${out}/diagnostics.json`, JSON.stringify(diagnostic, null, 2))
})
console.log(`Evidence saved: ${out}`)
