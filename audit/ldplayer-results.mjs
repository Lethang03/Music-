import fs from 'node:fs'
const name = process.argv[2]
const rows = JSON.parse(fs.readFileSync(`audit/ldplayer-${name}/summary.json`, 'utf8'))
const step = id => rows.find(row => row.step === id)
const playing = row => row?.state.some(s => /state=3,/.test(s)) && row?.audio?.paused === false
const off = row => row?.screen.includes('Display Power: state=OFF')
const advancing = (a, b) => playing(b) && a?.audio?.src === b.audio.src && b.audio.time > a.audio.time + 1
const changed = (a, b) => a?.audio?.src !== b?.audio?.src && playing(b) && b.audio.time > 1
const result = {
  foregroundNext: advancing(step('02-foreground-next-immediate'), step('03-foreground-next-later')) && step('03-foreground-next-later').audio.visibility === 'visible',
  backgroundNext: changed(step('04-home'), step('06-background-next-later')) && step('06-background-next-later').audio.visibility === 'hidden',
  lockedNextKeyevent: off(step('07-power-off')) && off(step('09-locked-next-later')) && changed(step('07-power-off'), step('09-locked-next-later')),
  lockedNextMediaService: off(step('09c-locked-service-next-later')) && changed(step('09-locked-next-later'), step('09c-locked-service-next-later')),
  previous: changed(step('06-background-next-later'), step('11-previous-later')),
  pauseResume: step('12-paused').state.some(s => /state=2,/.test(s)) && step('13-still-paused').audio.paused && Math.abs(step('12-paused').audio.time - step('13-still-paused').audio.time) < 0.1 && advancing(step('13-still-paused'), step('15-resume-later')),
  autoNextLocked: off(step('16-before-natural-end-locked')) && off(step('17-auto-next')) && step('16-before-natural-end-locked').audio.time > 60 && changed(step('16-before-natural-end-locked'), step('17-auto-next')) && advancing(step('17-auto-next'), step('18-auto-next-later'))
}
const verdict = Object.fromEntries(Object.entries(result).map(([key, value]) => [key, value ? 'PASS' : 'FAIL']))
fs.writeFileSync(`audit/ldplayer-${name}/verdict.json`, JSON.stringify(verdict, null, 2))
console.log(verdict)
