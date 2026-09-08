import { spawn } from 'node:child_process'
import { chromium, expect } from '@playwright/test'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const temp = path.resolve('audit/tmp')
mkdirSync(temp, { recursive: true })
process.env.TEMP = process.env.TMP = temp
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '3200', '--strictPort'], { stdio: 'ignore', windowsHide: true })
let browser
try {
  let ready = false
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error('Preview server exited')
    try { if ((await fetch('http://127.0.0.1:3200')).ok) { ready = true; break } } catch { /* Starting preview. */ }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  assert.ok(ready, 'Preview server starts')
  browser = await chromium.launch({ channel: 'chrome' })
  const context = await browser.newContext()
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:3200')
  await expect(page.getByRole('button', { name: 'Start Listening Now' })).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  for (const size of [192,512]) {
    const png = readFileSync(`public/icon-${size}.png`)
    assert.equal(png.readUInt32BE(16), size)
    assert.equal(png.readUInt32BE(20), size)
    assert.equal((await fetch(`http://127.0.0.1:3200/icon-${size}.png`)).status, 200)
  }
  await context.setOffline(true)
  await page.goto('http://127.0.0.1:3200/podcasts')
  await expect(page.getByRole('heading', { name: 'You’re offline' })).toBeVisible()
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('button', { name: 'Start Listening Now' })).toBeVisible()
  assert.deepEqual(errors, [])
  const passed = ['production bundle boots', 'service worker activates', '192px and 512px manifest icons exist', 'offline navigation shows standalone fallback', 'reconnect retry restores application', 'no uncaught browser errors']
  writeFileSync('audit/production-results.json', JSON.stringify({ passed }, null, 2))
  console.log(`${passed.length} production checks passed`)
} catch (error) { console.error(error); process.exitCode = 1 }
finally { await browser?.close(); server.kill() }
