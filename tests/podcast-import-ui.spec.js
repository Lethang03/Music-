import { test, expect } from '@playwright/test'
import { setup } from './fixtures'

async function openImport(page, options = {}) {
  const fixture = await setup(page, { admin: true, ...options })
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Import Podcast', exact: true }).click()
  return fixture
}

test('RSS default, exclusive URL content, keyboard switching and RSS draft preservation', async ({ page }) => {
  await openImport(page)
  const rss = page.getByRole('button', { name: 'RSS Feed', exact: true })
  const video = page.getByRole('button', { name: 'TikTok / YouTube', exact: true })
  await expect(rss).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('RSS Feed URL').fill('https://example.test/podcast/rss')
  await expect(page.locator('.podcast-url-form')).toHaveCount(0)
  await video.focus(); await video.press('Enter')
  await expect(video).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('RSS Feed URL')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Import TikTok / YouTube Episode' })).toBeVisible()
  await expect(page.getByText('Paste an authorized TikTok or YouTube video URL.')).toBeVisible()
  await rss.click()
  await expect(page.getByLabel('RSS Feed URL')).toHaveValue('https://example.test/podcast/rss')
  await expect(page.locator('.podcast-url-form')).toHaveCount(0)
})

test('invalid source, podcast and permission gate submission with useful guidance', async ({ page }) => {
  const { podcastId } = await openImport(page)
  await page.getByRole('button', { name: 'TikTok / YouTube', exact: true }).click()
  const submit = page.getByRole('button', { name: 'Import Episode', exact: true })
  await expect(submit).toBeDisabled()
  await page.getByLabel('Source URL', { exact: true }).fill('https://evil.example/video')
  await expect(page.getByText('Invalid TikTok / YouTube URL.', { exact: false })).toBeVisible()
  await expect(submit).toBeDisabled()
  await page.getByLabel('Source URL', { exact: true }).fill('https://youtu.be/dQw4w9WgXcQ')
  await expect(page.getByText('Select a podcast.', { exact: true })).toBeVisible()
  await expect(submit).toBeDisabled()
  await page.getByLabel('Podcast', { exact: true }).selectOption(podcastId)
  await expect(page.getByText('Confirm permission before importing.', { exact: true })).toBeVisible()
  await expect(submit).toBeDisabled()
  await expect(page.locator('.podcast-selected-preview img')).toBeVisible()
  await page.getByLabel('I own this content or have permission to import it.').check()
  await expect(submit).toBeEnabled()
})

for (const source of ['https://youtu.be/dQw4w9WgXcQ', 'https://vt.tiktok.com/AbCd123/']) {
  test('existing import helper receives episode metadata: ' + source, async ({ page }) => {
    const { podcastId } = await openImport(page)
    let payload
    let rssRequests = 0
    await page.route('https://corsproxy.io/**', route => { rssRequests++; return route.abort() })
    await page.route('**/functions/v1/import-job', route => {
      payload = route.request().postDataJSON()
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ job: { id: 'queued-episode', status: 'pending' } }) })
    })
    await page.getByRole('button', { name: 'TikTok / YouTube', exact: true }).click()
    await page.getByLabel('Source URL', { exact: true }).fill(source)
    await page.getByLabel('Podcast', { exact: true }).selectOption(podcastId)
    await page.getByLabel('Title (optional)', { exact: true }).fill('My episode')
    await page.getByLabel('Description (optional)', { exact: true }).fill('Episode description')
    await page.getByLabel('Episode number (optional)', { exact: true }).fill('4')
    await page.getByLabel('Season (optional)', { exact: true }).fill('2')
    await page.getByLabel('I own this content or have permission to import it.').check()
    await page.getByRole('button', { name: 'Import Episode', exact: true }).click()
    await expect.poll(() => payload?.source_type).toBe('podcast_episode_url')
    expect(payload.podcast_id).toBe(podcastId)
    expect(payload.source_url).toBe(source.includes('youtu.be') ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' : source)
    expect(payload.metadata).toMatchObject({ title: 'My episode', description: 'Episode description', episode_number: 4, season_number: 2, authorized: true })
    expect(rssRequests).toBe(0)
  })
}

test('no published podcasts produces an actionable empty state', async ({ page }) => {
  const { db } = await setup(page, { admin: true })
  db.podcasts[0].published = false
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Import Podcast', exact: true }).click()
  await page.getByRole('button', { name: 'TikTok / YouTube', exact: true }).click()
  await expect(page.getByText('No published podcasts available.')).toBeVisible()
  await expect(page.getByText('Create or publish a podcast first.')).toBeVisible()
  await expect(page.getByLabel('Podcast', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Import Episode', exact: true })).toBeDisabled()
})

test('internal backend failure details are not displayed', async ({ page }) => {
  const { podcastId } = await openImport(page)
  await page.route('**/functions/v1/import-job', route => route.fulfill({ status:500, contentType:'application/json', body:JSON.stringify({error:'ffmpeg failed in /app/private/worker.js with SECRET_TOKEN\n at internalProcess'}) }))
  await page.getByRole('button', {name:'TikTok / YouTube',exact:true}).click()
  await page.getByLabel('Source URL',{exact:true}).fill('https://youtu.be/dQw4w9WgXcQ')
  await page.getByLabel('Podcast',{exact:true}).selectOption(podcastId)
  await page.getByLabel('I own this content or have permission to import it.').check()
  await page.getByRole('button',{name:'Import Episode',exact:true}).click()
  await expect(page.locator('.podcast-import-error')).toHaveText('The import service is unavailable. Please retry.')
  await expect(page.getByText('SECRET_TOKEN',{exact:false})).toHaveCount(0)
})

test('URL queue shows existing job stages and remains separate from RSS', async ({ page }) => {
  const { db } = await setup(page, { admin: true })
  db.import_jobs = ['Extracting','Downloading','Converting','Uploading','Creating Episode'].map((stage, i) => ({ id: String(i), source_type:'podcast_episode_url', source_platform:'youtube', source_url:'https://youtu.be/dQw4w9WgXcQ', status:stage === 'Uploading' || stage === 'Creating Episode' ? 'uploading' : 'extracting', progress:20+i*15, metadata:{ stage, title:'Job '+i } }))
  db.import_jobs.push({ id:'rss', source_type:'url', status:'pending', metadata:{title:'Unrelated music job'} })
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Import Podcast', exact: true }).click()
  await expect(page.getByText('Job 0', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'TikTok / YouTube', exact: true }).click()
  for (const stage of ['Extracting','Downloading','Converting','Uploading','Creating Episode']) await expect(page.locator('.podcast-import-queue').getByText(stage, { exact:true })).toBeVisible()
  await expect(page.getByText('Unrelated music job')).toHaveCount(0)
})

for (const [width,height] of [[1920,1080],[1440,900],[1280,720],[768,1024],[430,932],[390,844],[375,667],[360,800]]) {
  test('responsive podcast tabs and controls ' + width + 'x' + height, async ({ page }) => {
    await page.setViewportSize({width,height})
    const { podcastId, errors } = await openImport(page)
    const buttons = page.locator('.podcast-import-tabs button')
    const first = await buttons.nth(0).boundingBox(); const second = await buttons.nth(1).boundingBox()
    expect(second.x - (first.x + first.width)).toBeGreaterThanOrEqual(7)
    expect(first.height).toBeGreaterThanOrEqual(44); expect(second.height).toBeGreaterThanOrEqual(44)
    await buttons.nth(1).click()
    await page.getByLabel('Podcast', {exact:true}).selectOption(podcastId)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    for (const selector of ['.podcast-import-tabs','.podcast-url-form','#podcast-source-url','#podcast-import-target','.podcast-url-form button[type=submit]']) {
      const box = await page.locator(selector).boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width)
    }
    if ([390,1280].includes(width)) {
      await page.locator('.v2-main-content').evaluate(el => { el.scrollTop=0 })
      await page.screenshot({path:'audit/podcast-import-ui-' + width + '.png',fullPage:true})
    }
    expect(errors).toEqual([])
  })
}
