import { test, expect } from '@playwright/test'
import { setup, playerBar } from './fixtures'
import fs from 'node:fs'

const output = 'audit/ui-redesign'
test.beforeAll(() => fs.mkdirSync(output, { recursive: true }))

test.describe('Now Playing Artwork 3D Tilt & Specular Glare Suite', () => {
  test('interactive 3D tilt, elevation, specular reflection, and smooth reset on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await setup(page, { seconds: 180 })

    await page.goto('/music')
    await page.getByRole('button', { name: 'Play Track 1', exact: true }).click()
    await expect(playerBar(page).getByTitle('Pause', { exact: true })).toBeVisible()

    await playerBar(page).getByTitle('Open Now Playing', { exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Now playing' })
    await expect(dialog).toBeVisible()

    const artFrame = dialog.locator('.sv-np-artwork-frame')
    await expect(artFrame).toBeVisible()

    const glare = artFrame.locator('.sv-np-artwork-glare')
    await expect(glare).toBeAttached()

    // 1. Hover onto artwork center
    const box = await artFrame.boundingBox()
    expect(box).not.toBeNull()

    // Move to top-right corner of artwork to trigger 3D tilt
    const targetX = box.x + box.width * 0.8
    const targetY = box.y + box.height * 0.25

    await page.mouse.move(targetX, targetY)
    await page.waitForTimeout(200)

    // Verify .is-hovered class
    await expect(artFrame).toHaveClass(/is-hovered/)

    // Verify CSS variables applied on element
    const tiltValues = await artFrame.evaluate((el) => ({
      tiltX: el.style.getPropertyValue('--art-tilt-x'),
      tiltY: el.style.getPropertyValue('--art-tilt-y'),
      scale: el.style.getPropertyValue('--art-scale'),
      lift: el.style.getPropertyValue('--art-lift'),
      glareX: el.style.getPropertyValue('--glare-x'),
      glareY: el.style.getPropertyValue('--glare-y'),
      glareOpacity: el.style.getPropertyValue('--glare-opacity')
    }))

    // Rotate Y should be positive (cursor is to the right)
    expect(parseFloat(tiltValues.tiltX)).toBeGreaterThan(0)
    // Rotate X should be positive (cursor is at the top)
    expect(parseFloat(tiltValues.tiltY)).toBeGreaterThan(0)
    expect(tiltValues.scale).toBe('1.035')
    expect(tiltValues.lift).toBe('-5px')
    expect(parseFloat(tiltValues.glareX)).toBeGreaterThan(60)
    expect(parseFloat(tiltValues.glareY)).toBeLessThan(40)
    expect(tiltValues.glareOpacity).toBe('0.75')

    // Capture screenshot of tilted artwork with specular glare
    await page.screenshot({ path: `${output}/artwork-3d-tilt-desktop.png` })

    // 2. Move mouse away to reset
    await page.mouse.move(100, 100)
    await page.waitForTimeout(350)

    await expect(artFrame).not.toHaveClass(/is-hovered/)

    const resetValues = await artFrame.evaluate((el) => ({
      tiltX: el.style.getPropertyValue('--art-tilt-x'),
      tiltY: el.style.getPropertyValue('--art-tilt-y'),
      scale: el.style.getPropertyValue('--art-scale'),
      lift: el.style.getPropertyValue('--art-lift'),
      glareOpacity: el.style.getPropertyValue('--glare-opacity')
    }))

    expect(resetValues.tiltX).toBe('0deg')
    expect(resetValues.tiltY).toBe('0deg')
    expect(resetValues.scale).toBe('1')
    expect(resetValues.lift).toBe('0px')
    expect(resetValues.glareOpacity).toBe('0')
  })

  test('mobile fallback disables tilt and glare (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setup(page, { seconds: 180 })

    await page.goto('/music')
    await page.getByRole('button', { name: 'Play Track 1', exact: true }).click()
    await playerBar(page).getByTitle('Open Now Playing', { exact: true }).click()

    const dialog = page.getByRole('dialog', { name: 'Now playing' })
    await expect(dialog).toBeVisible()

    const glareDisplay = await dialog.locator('.sv-np-artwork-glare').evaluate(
      (el) => window.getComputedStyle(el).display
    )
    expect(glareDisplay).toBe('none')

    const cursorStyle = await dialog.locator('.sv-np-artwork-frame').evaluate(
      (el) => window.getComputedStyle(el).cursor
    )
    expect(cursorStyle).toBe('default')

    await page.screenshot({ path: `${output}/artwork-mobile-390.png` })
  })

  test('prefers-reduced-motion disables 3D tilt and glare', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await setup(page, { seconds: 180 })

    await page.goto('/music')
    await page.getByRole('button', { name: 'Play Track 1', exact: true }).click()
    await playerBar(page).getByTitle('Open Now Playing', { exact: true }).click()

    const dialog = page.getByRole('dialog', { name: 'Now playing' })
    await expect(dialog).toBeVisible()

    const glareDisplay = await dialog.locator('.sv-np-artwork-glare').evaluate(
      (el) => window.getComputedStyle(el).display
    )
    expect(glareDisplay).toBe('none')
  })
})

