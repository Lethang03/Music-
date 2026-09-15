import { test, expect } from '@playwright/test'
import { numberImportedEpisodes, orderEpisodes, nextEpisodeNumber } from '../src/lib/episodeOrder.js'
import { setup } from './fixtures.js'

test('episode ordering is stable and display numbering is continuous for missing and duplicate values', async ({ page }) => {
  const { db, podcastId, errors } = await setup(page)
  db.episodes = [
    { ...db.episodes[0], id: 'ep-1', title: 'First', episode_number: 1, season_number: 1, published_at: '2026-01-01T00:00:00Z' },
    { ...db.episodes[1], id: 'ep-2', title: 'Duplicate', episode_number: 1, season_number: 2, published_at: '2026-01-02T00:00:00Z' },
    { ...db.episodes[2], id: 'ep-3', title: 'Unnumbered', episode_number: null, season_number: 2, published_at: '2026-01-03T00:00:00Z' },
    { ...db.episodes[2], id: 'ep-4', title: 'Later', episode_number: 4, season_number: 1, published_at: '2026-01-04T00:00:00Z' },
  ]
  await page.goto(`/podcasts/${podcastId}`)
  await expect(page.locator('.v2-ep-title')).toHaveText(['First', 'Duplicate', 'Later', 'Unnumbered'])
  await expect(page.locator('.v2-ep-index')).toHaveText(['1', '2', '3', '4'])
  expect(errors).toEqual([])
})

test('new RSS, TikTok, YouTube and manual episodes use the next number when omitted', () => {
  const existing = [{ episode_number: 1 }, { episode_number: 2 }, { episode_number: 5 }, { episode_number: null }]
  expect(nextEpisodeNumber(existing)).toBe(6)
  for (const source of ['rss', 'tiktok', 'youtube', 'manual']) {
    expect(numberImportedEpisodes([{ id: source, episode_number: null }], existing)[0].episode_number).toBe(6)
  }
})

test('RSS batches allocate missing numbers in publication order and preserve supplied values', () => {
  const entries = [
    { id: 'newest', published_at: '2026-02-03T00:00:00Z', episode_number: null },
    { id: 'supplied', published_at: '2026-02-02T00:00:00Z', episode_number: 22 },
    { id: 'oldest', published_at: '2026-02-01T00:00:00Z', episode_number: null },
  ]
  const numbered = numberImportedEpisodes(entries, [{ episode_number: 20 }])
  expect(numbered.map(entry => entry.id)).toEqual(['supplied', 'oldest', 'newest'])
  expect(numbered.map(entry => entry.episode_number)).toEqual([22, 23, 24])
  expect(orderEpisodes([{ id: 'a', episode_number: null, published_at: '2026-01-02' }, { id: 'b', episode_number: null, published_at: '2026-01-01' }]).map(x => x.id)).toEqual(['b', 'a'])
})

for (const [width, height] of [[375, 667], [390, 844], [430, 932], [768, 1024], [1280, 800]]) {
  test(`episode list remains aligned at ${width}x${height}`, async ({ page }) => {
    const { db, podcastId, errors } = await setup(page)
    db.episodes = Array.from({ length: 12 }, (_, index) => ({
      ...db.episodes[index % db.episodes.length],
      id: `episode-${index + 1}`,
      title: `A readable episode title ${index + 1}`,
      episode_number: index % 4 === 0 ? null : index + 1,
      published_at: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
    }))
    await page.setViewportSize({ width, height })
    await page.goto(`/podcasts/${podcastId}`)
    await page.locator('.v2-ep-row').first().click()
    const last = page.locator('.v2-ep-row').last()
    await last.scrollIntoViewIfNeeded()
    await expect(page.locator('.v2-ep-index')).toHaveText(Array.from({ length: 11 }, (_, index) => String(index + 2)))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const player = page.locator('.v2-player-bar')
    const [lastBox, playerBox] = await Promise.all([last.boundingBox(), player.boundingBox()])
    expect(lastBox?.x).toBeGreaterThanOrEqual(0)
    expect(lastBox?.width).toBeLessThanOrEqual(width)
    expect((lastBox?.y ?? height) + (lastBox?.height ?? 0)).toBeLessThanOrEqual((playerBox?.y ?? height) + 1)
    expect(errors).toEqual([])
  })
}
