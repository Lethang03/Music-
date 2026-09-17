import { test, expect } from '@playwright/test'
import { setup, playerBar } from './fixtures'
import fs from 'node:fs'

const output = 'audit/ui-redesign'
test.beforeAll(() => fs.mkdirSync(output, { recursive: true }))

async function shot(page, name) {
  await page.screenshot({ path: `${output}/${name}.png`, animations: 'disabled' })
}

async function prepare(page) {
  const data = await setup(page, { admin: true, seconds: 180 })
  data.db.music_tracks = [
    {
      id: 'track-eq-1',
      title: 'Neon Odyssey',
      artist: 'Starlight Echoes',
      album: 'Cosmic Journey',
      duration: 180,
      audio_url: 'http://127.0.0.1:3100/test-audio/1.wav?seconds=180',
      cover_url: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#0284c7"/></svg>'),
      published: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'track-eq-2',
      title: 'Aurora Horizon',
      artist: 'Solar Pulse',
      album: 'Cosmic Journey',
      duration: 180,
      audio_url: 'http://127.0.0.1:3100/test-audio/2.wav?seconds=180',
      cover_url: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#7c3aed"/></svg>'),
      published: true,
      created_at: new Date().toISOString()
    }
  ]
  return data
}

test('audio settings button toggles popover, closes on Escape, outside click, and close button', async ({ page }) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await prepare(page)

  await page.goto('/music')
  await expect(page.getByRole('button', { name: 'Play Neon Odyssey', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Play Neon Odyssey', exact: true }).click()
  await expect(playerBar(page).getByTitle('Pause', { exact: true })).toBeVisible()

  // Open Now Playing
  await playerBar(page).getByTitle('Open Now Playing', { exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Now playing' })
  await expect(dialog).toBeVisible()

  // Audio settings button exists next to volume
  const eqBtn = dialog.locator('.sv-np-eq-btn')
  await expect(eqBtn).toBeVisible()
  await expect(eqBtn).toHaveAttribute('aria-label', 'Audio settings')
  await expect(eqBtn).toHaveAttribute('aria-expanded', 'false')

  // Clicking button opens the popover
  await eqBtn.click()
  await expect(eqBtn).toHaveAttribute('aria-expanded', 'true')
  const popover = dialog.locator('.sv-np-eq-popover')
  await expect(popover).toBeVisible()
  await expect(popover.locator('.sv-np-eq-popover-title')).toHaveText('Audio Settings')

  // Close via close button (X)
  const closeBtn = popover.locator('.sv-np-eq-close-btn')
  await closeBtn.click()
  await expect(popover).toHaveCount(0)
  await expect(eqBtn).toHaveAttribute('aria-expanded', 'false')

  // Re-open and close via Escape
  await eqBtn.click()
  await expect(popover).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(popover).toHaveCount(0)

  // Re-open and close via clicking outside
  await eqBtn.click()
  await expect(popover).toBeVisible()
  await dialog.locator('.sv-np-brand').click()
  await expect(popover).toHaveCount(0)
})

test('equalizer master toggle, presets selection, and custom slider adjustments', async ({ page }) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await prepare(page)

  await page.goto('/music')
  await page.getByRole('button', { name: 'Play Neon Odyssey', exact: true }).click()
  await playerBar(page).getByTitle('Open Now Playing', { exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'Now playing' })
  const eqBtn = dialog.locator('.sv-np-eq-btn')
  await eqBtn.click()

  const popover = dialog.locator('.sv-np-eq-popover')
  await expect(popover).toBeVisible()

  // Master switch starts bypassed
  const masterSwitch = popover.getByRole('switch', { name: 'Toggle Equalizer' })
  await expect(masterSwitch).toBeVisible()
  await expect(masterSwitch).toHaveAttribute('aria-checked', 'false')
  await expect(popover.locator('.sv-np-eq-status-badge')).toHaveText('Bypassed')

  // Toggle master switch ON
  await masterSwitch.click()
  await expect(masterSwitch).toHaveAttribute('aria-checked', 'true')
  await expect(popover.locator('.sv-np-eq-status-badge')).toHaveText('Active')
  await expect(eqBtn).toHaveClass(/is-enabled/)
  await expect(eqBtn.locator('.sv-np-eq-dot')).toBeVisible()

  // Change preset to 'Bass Boost' (+6 dB Bass, 0 dB Mid, -1 dB Treble)
  const presetSelect = popover.locator('#sv-eq-preset-select')
  await presetSelect.selectOption('Bass Boost')
  await expect(presetSelect).toHaveValue('Bass Boost')

  const bassVal = popover.locator('.sv-np-eq-band').nth(0).locator('.sv-np-eq-band-val')
  const midVal = popover.locator('.sv-np-eq-band').nth(1).locator('.sv-np-eq-band-val')
  const trebleVal = popover.locator('.sv-np-eq-band').nth(2).locator('.sv-np-eq-band-val')

  await expect(bassVal).toHaveText('+6 dB')
  await expect(midVal).toHaveText('0 dB')
  await expect(trebleVal).toHaveText('-1 dB')

  // Adjust mid slider manually to +4 dB -> switches preset to 'Custom'
  const midSlider = popover.getByLabel('Mid gain')
  await midSlider.fill('4')
  await midSlider.dispatchEvent('change')

  await expect(midVal).toHaveText('+4 dB')
  await expect(presetSelect).toHaveValue('Custom')

  // Click 'Reset to Flat'
  const resetBtn = popover.locator('.sv-np-eq-reset-btn')
  await resetBtn.click()

  await expect(presetSelect).toHaveValue('Default')
  await expect(bassVal).toHaveText('0 dB')
  await expect(midVal).toHaveText('0 dB')
  await expect(trebleVal).toHaveText('0 dB')

  // Take screenshot of open popover
  await shot(page, 'audio-settings-desktop')
})

test('audio playback continues smoothly while adjusting audio settings', async ({ page }) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await prepare(page)

  await page.goto('/music')
  await page.getByRole('button', { name: 'Play Neon Odyssey', exact: true }).click()
  await expect(playerBar(page).getByTitle('Pause', { exact: true })).toBeVisible()

  await playerBar(page).getByTitle('Open Now Playing', { exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Now playing' })
  await dialog.locator('.sv-np-eq-btn').click()

  const popover = dialog.locator('.sv-np-eq-popover')

  // Toggle EQ ON while audio is playing
  await popover.getByRole('switch', { name: 'Toggle Equalizer' }).click()

  // Verify play state remains 'Pause' (actively playing, not interrupted)
  await expect(dialog.getByTitle('Pause', { exact: true })).toBeVisible()

  // Select Electronic preset
  await popover.locator('#sv-eq-preset-select').selectOption('Electronic')
  await expect(dialog.getByTitle('Pause', { exact: true })).toBeVisible()

  // Adjust Bass slider
  await popover.getByLabel('Bass gain').fill('10')
  await popover.getByLabel('Bass gain').dispatchEvent('change')
  await expect(dialog.getByTitle('Pause', { exact: true })).toBeVisible()

  // Toggle EQ OFF
  await popover.getByRole('switch', { name: 'Toggle Equalizer' }).click()
  await expect(dialog.getByTitle('Pause', { exact: true })).toBeVisible()
})

test('settings persist across track transitions and page reloads', async ({ page }) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await prepare(page)

  await page.goto('/music')
  await page.getByRole('button', { name: 'Play Neon Odyssey', exact: true }).click()
  await playerBar(page).getByTitle('Open Now Playing', { exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'Now playing' })
  await dialog.locator('.sv-np-eq-btn').click()

  const popover = dialog.locator('.sv-np-eq-popover')
  await popover.getByRole('switch', { name: 'Toggle Equalizer' }).click()
  await popover.locator('#sv-eq-preset-select').selectOption('Vocal')

  // Verify in localStorage
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('v2_equalizer_settings') || '{}'))
  expect(stored.enabled).toBe(true)
  expect(stored.preset).toBe('Vocal')
  expect(stored.values?.mid).toBe(5)

  // Switch to next track (Aurora Horizon)
  await dialog.getByTitle('Next', { exact: true }).click()
  await expect(dialog.locator('.sv-np-track-title')).toHaveText('Aurora Horizon')

  // Verify button still shows active indicator
  const eqBtn = dialog.locator('.sv-np-eq-btn')
  await expect(eqBtn).toHaveClass(/is-enabled/)
  await expect(eqBtn.locator('.sv-np-eq-dot')).toBeVisible()

  // Reload page
  await page.reload()
  await expect(page.locator('.music-hero')).toBeVisible()

  // Check persisted localStorage state survived reload
  const reloadedStored = await page.evaluate(() => JSON.parse(localStorage.getItem('v2_equalizer_settings') || '{}'))
  expect(reloadedStored.enabled).toBe(true)
  expect(reloadedStored.preset).toBe('Vocal')
})

test('audio settings popover renders cleanly on mobile viewports', async ({ page }) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width: 390, height: 844 })
  await prepare(page)

  await page.goto('/music')
  await page.getByRole('button', { name: 'Play Neon Odyssey', exact: true }).click()
  await playerBar(page).getByTitle('Open Now Playing', { exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'Now playing' })
  await dialog.getByRole('button', { name: 'Queue', exact: true }).click()

  const eqBtn = dialog.locator('.sv-np-eq-btn')
  await expect(eqBtn).toBeVisible()
  await eqBtn.click()

  const popover = dialog.locator('.sv-np-eq-popover')
  await expect(popover).toBeVisible()

  // Verify no horizontal overflow on mobile
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  expect(noOverflow).toBe(true)

  await shot(page, 'audio-settings-mobile')
})

