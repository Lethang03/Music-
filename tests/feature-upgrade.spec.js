import { test, expect } from '@playwright/test'
import { setup, playFirst, playerBar, tracks } from './fixtures'
import { parseLrc, parseSyncedLyrics, activeLyricIndex } from '../src/lib/lyrics'
import { validatePodcastSource } from '../workers/audio-worker/podcastSource'
import { validatePodcastSource as validateEdgeSource } from '../supabase/functions/import-job/podcastSource'

test('podcast source validation and canonical identities', () => {
  for (const url of ['https://youtu.be/dQw4w9WgXcQ','https://www.tiktok.com/@host/video/1234567890','https://vt.tiktok.com/AbCd123/']) expect(validateEdgeSource(url)).toEqual(validatePodcastSource(url))
  for (const url of ['https://youtu.be/dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=ignored']) expect(validatePodcastSource(url)).toEqual({ source_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', source_platform: 'youtube', source_id: 'dQw4w9WgXcQ' })
  expect(validatePodcastSource('https://www.tiktok.com/@host/video/1234567890').source_id).toBe('1234567890')
  for (const host of ['vm','vt']) expect(validatePodcastSource(`https://${host}.tiktok.com/AbCd123/`).source_platform).toBe('tiktok')
  for (const url of ['https://youtube.com.evil.test/watch?v=dQw4w9WgXc', 'https://youtube.com/playlist?list=abc', 'https://tiktok.com/@host', 'file:///tmp/audio', 'https://user:password@youtube.com/watch?v=dQw4w9WgXc', 'https://127.0.0.1/video/123']) expect(() => validatePodcastSource(url)).toThrow()
})

test('LRC parser handles timestamp precision, sorting, offsets and malformed input', () => {
  const rows = parseLrc('[ar:Artist]\n[00:16.200]Second\n[00:12.40]First\n[00:20]Third\n[00:99]Invalid\n[bad]Bad', 30)
  expect(rows).toEqual([{ start:12.4, end:16.2, text:'First' },{ start:16.2, end:20, text:'Second' },{ start:20, end:30, text:'Third' }])
  expect(parseLrc('[offset:-100]\n[01:00.123][01:02.1]Repeat')[0].start).toBeCloseTo(60.023)
  expect(parseSyncedLyrics('invalid')).toEqual([])
  expect(parseSyncedLyrics([{ start:null, end:3, text:'bad' }])).toEqual([])
  expect(activeLyricIndex(rows, 0)).toBe(-1)
  expect(activeLyricIndex(rows, 12.4)).toBe(0)
  expect(activeLyricIndex(rows, 16.2)).toBe(1)
  expect(activeLyricIndex(rows, 30)).toBe(-1)
})

for (const [width,height] of [[375,667],[390,844],[430,932],[360,800],[412,915],[768,1024],[1280,800],[1920,1080]]) {
  test(`music and lyrics responsive ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({width,height})
    const { db, errors } = await setup(page, { seconds:30 })
    db.music_tracks[0].lyrics_type = 'synced'
    db.music_tracks[0].synced_lyrics = Array.from({length:15},(_,i) => ({start:i*2,end:i*2+2,text:`Lyric line ${i}`}))
    await playFirst(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('button',{name:'Grid view'})).toBeVisible()
    await expect(page.getByRole('button',{name:'List view'})).toBeVisible()
    const searchBox = await page.getByRole('textbox',{name:'Search music'}).boundingBox()
    const searchIcon = await page.locator('.music-search>svg').boundingBox()
    expect(Math.abs(searchBox.y + searchBox.height/2 - searchIcon.y - searchIcon.height/2)).toBeLessThan(5)
    if ([390,1280].includes(width)) { await page.locator('.v2-main-content').evaluate(el => { el.scrollTop=0 }); await page.screenshot({path:`audit/music-grid-${width}.png`}) }
    await page.getByRole('button',{name:'List view'}).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.locator('.music-list-row')).toHaveCount(3)
    if ([390,1280].includes(width)) { await page.locator('.v2-main-content').evaluate(el => { el.scrollTop=0 }); await page.screenshot({path:`audit/music-library-${width}.png`}) }
    await playerBar(page).getByTitle('Open Now Playing',{exact:true}).first().click()
    await page.getByRole('button',{name:'Lyrics',exact:true}).click()
    await expect(page.locator('.v2-synced-lyric.active')).toBeVisible()
    const box = await page.locator('.v2-synced-lyrics').boundingBox()
    expect(box.height).toBeGreaterThan(100)
    const activeBox = await page.locator('.v2-synced-lyric.active').boundingBox()
    expect(activeBox.y + activeBox.height).toBeLessThan(height - (width <= 768 ? 140 : 80))
    expect(await page.locator('.v2-synced-lyrics').evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if ([390,1280].includes(width)) await page.screenshot({path:`audit/music-lyrics-${width}.png`})
    expect(await page.evaluate(() => window.testAudio.filter(a => a.src).length)).toBe(1)
    expect(errors).toEqual([])
  })
}

test('lyrics seek, manual scroll, song reset and plain fallback', async ({page}) => {
  const {db} = await setup(page,{seconds:30})
  db.music_tracks[0].lyrics_type='synced'
  db.music_tracks[0].synced_lyrics=[{start:0,end:10,text:'First line'},{start:10,end:30,text:'Second line'}]
  db.music_tracks[1].lyrics='Plain fallback for second song'
  await playFirst(page)
  await playerBar(page).getByTitle('Open Now Playing',{exact:true}).first().click()
  await page.getByRole('button',{name:'Lyrics',exact:true}).click()
  await page.getByRole('button',{name:'Seek to 10 seconds: Second line'}).click()
  await expect(page.locator('.v2-synced-lyric.active')).toHaveText('Second line')
  await expect(page.getByRole('button',{name:'Follow Lyrics',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Follow Lyrics',exact:true}).click()
  await expect(page.getByRole('button',{name:'Following lyrics'})).toHaveAttribute('aria-pressed','true')
  await page.getByTitle('Close',{exact:true}).click()
  await expect(page.getByRole('dialog',{name:'Now playing',exact:true})).toBeHidden()
  await playerBar(page).getByTitle('Next',{exact:true}).click()
  await playerBar(page).getByTitle('Open Now Playing',{exact:true}).first().click()
  await page.getByRole('button',{name:'Lyrics',exact:true}).click()
  await expect(page.getByText('Plain fallback for second song')).toBeVisible()
  await expect(page.locator('.v2-synced-lyric')).toHaveCount(0)
})

test('admin queues an authorized podcast episode with metadata', async ({page}) => {
  const {podcastId} = await setup(page,{admin:true})
  let payload
  await page.route('**/rest/v1/import_jobs*',route => route.fulfill({contentType:'application/json',body:'[]'}))
  await page.route('**/functions/v1/import-job',route => { payload=route.request().postDataJSON(); return route.fulfill({contentType:'application/json',body:JSON.stringify({job:{id:'job-1',status:'pending'}})}) })
  await page.goto('/admin')
  await page.getByRole('button',{name:'Import Podcast',exact:true}).click()
  await page.getByRole('button',{name:'TikTok / YouTube',exact:true}).click()
  await page.getByLabel('Source URL',{exact:false}).fill('https://youtu.be/dQw4w9WgXcQ')
  await page.getByLabel('Podcast',{exact:true}).selectOption(podcastId)
  await page.getByLabel('Title (optional)',{exact:true}).fill('My episode')
  await page.getByLabel('I own this content or have permission to import it.').check()
  await page.getByRole('button',{name:'Import Episode',exact:true}).click()
  await expect.poll(() => payload?.source_type).toBe('podcast_episode_url')
  expect(payload.podcast_id).toBe(podcastId)
  expect(payload.metadata.title).toBe('My episode')
  expect(payload.metadata.authorized).toBe(true)
  await page.route('**/functions/v1/import-job',route => route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'This source is already queued or imported.'})}))
  await page.getByLabel('Source URL',{exact:false}).fill('https://youtu.be/dQw4w9WgXcQ')
  await page.getByLabel('I own this content or have permission to import it.').check()
  await page.getByRole('button',{name:'Import Episode',exact:true}).click()
  await expect(page.locator('.podcast-url-import').getByRole('alert')).toHaveText('This source is already queued or imported.')
})

test('admin parses, previews and saves LRC while preserving plain lyrics', async ({page}) => {
  const {db} = await setup(page,{admin:true})
  db.music_tracks[0].lyrics='Original plain lyrics'
  await page.goto('/admin')
  await page.locator('tr').filter({hasText:'Track 1'}).getByRole('button',{name:'Edit',exact:true}).click()
  await page.getByRole('button',{name:'Advanced Details'}).click()
  await page.getByLabel('lyrics type').selectOption('synced')
  await page.getByLabel('Paste LRC').fill('[00:00.00]Opening line\n[00:05.500]Next line')
  await page.getByRole('button',{name:'Parse / Preview'}).click()
  await expect(page.locator('.lyric-admin-preview')).toContainText('00:05.500 Next line')
  await page.getByRole('button',{name:'Save content',exact:true}).click()
  await expect.poll(() => db.music_tracks[0].lyrics_type).toBe('synced')
  expect(db.music_tracks[0].synced_lyrics[1].start).toBe(5.5)
  expect(db.music_tracks[0].lyrics).toBe('Original plain lyrics')
})

test('restored queue snapshots use current catalog lyrics', async ({page}) => {
  const stale = { ...tracks(30)[0], lyrics:'Old lyrics snapshot', lyrics_type:'plain' }
  const {db} = await setup(page,{seconds:30,player:{queue:[stale],index:0,currentTime:0}})
  db.music_tracks[0].lyrics_type='synced'
  db.music_tracks[0].synced_lyrics=[{start:0,end:30,text:'Current catalog lyric'}]
  await page.goto('/music')
  await playerBar(page).getByTitle('Open Now Playing',{exact:true}).first().click()
  await page.getByRole('button',{name:'Lyrics',exact:true}).click()
  await expect(page.locator('.v2-synced-lyric.active')).toHaveText('Current catalog lyric')
  await expect(page.getByText('Old lyrics snapshot',{exact:true})).toHaveCount(0)
})
