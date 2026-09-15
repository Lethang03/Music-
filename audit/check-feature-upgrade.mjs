import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
const db = new PGlite()
const user = '11111111-1111-4111-8111-111111111111'
const podcast = '33333333-3333-4333-8333-333333333333'
const job = '55555555-5555-4555-8555-555555555555'
let count = 0
async function check(name, run) { await run(); count++; console.log('PASS', name) }
try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create table storage.buckets(id text primary key,name text,public boolean default false);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    grant usage on schema public,auth to anon,authenticated;`)
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8').replace(/^\uFEFF/, ''))
  await db.exec(`insert into auth.users(id,email) values ('${user}','fixture@example.test'); insert into podcasts(id,title,published) values ('${podcast}','Podcast',true)`)
  await check('podcast URL jobs require a valid target and platform', async () => {
    await assert.rejects(db.exec(`insert into import_jobs(source_url,source_type,created_by) values ('https://youtu.be/abcdefghijk','podcast_episode_url','${user}')`), /check constraint/)
  })
  await db.exec(`insert into import_jobs(id,source_url,source_type,podcast_id,source_platform,source_id,created_by) values ('${job}','https://youtu.be/abcdefghijk','podcast_episode_url','${podcast}','youtube','abcdefghijk','${user}')`)
  await check('duplicate active source jobs are blocked independently of URL', async () => {
    await assert.rejects(db.exec(`insert into import_jobs(source_url,source_type,podcast_id,source_platform,source_id,created_by) values ('https://youtube.com/shorts/abcdefghijk','podcast_episode_url','${podcast}','youtube','abcdefghijk','${user}')`), /unique constraint/)
  })
  await check('existing claim RPC receives podcast jobs and stale extraction is reclaimed', async () => {
    const first = await db.query('select * from claim_audio_import_job()')
    assert.equal(first.rows[0].id,job); assert.equal(first.rows[0].status,'processing')
    await db.exec(`update import_jobs set status='extracting',started_at=now()-interval '2 hours' where id='${job}'`)
    const second = await db.query('select * from claim_audio_import_job()')
    assert.equal(second.rows[0].retry_count,1)
  })
  await db.exec(`insert into episodes(podcast_id,title,published,import_job_id,source_platform,source_id) values ('${podcast}','Episode',true,'${job}','youtube','abcdefghijk')`)
  await check('source identity prevents episode duplicates on worker retries', async () => {
    await assert.rejects(db.exec(`insert into episodes(podcast_id,title,source_platform,source_id) values ('${podcast}','Duplicate','youtube','abcdefghijk')`), /unique constraint/)
    await assert.rejects(db.exec(`insert into episodes(podcast_id,title,import_job_id) values ('${podcast}','Retry','${job}')`), /unique constraint/)
  })
  await check('TikTok identity and ordinary RSS episodes coexist', async () => {
    await db.exec(`insert into episodes(podcast_id,title,source_platform,source_id) values ('${podcast}','TikTok','tiktok','abcdefghijk'); insert into episodes(podcast_id,title) values ('${podcast}','RSS 1'),('${podcast}','RSS 2')`)
    assert.equal((await db.query('select count(*)::integer as count from episodes')).rows[0].count,4)
  })
  await check('lyrics preserve plain defaults and validate JSON shape', async () => {
    const track = (await db.query(`insert into music_tracks(title,lyrics) values ('Plain','Original text') returning id,lyrics_type`)).rows[0]
    assert.equal(track.lyrics_type,'plain')
    await assert.rejects(db.exec(`update music_tracks set synced_lyrics='{}' where id='${track.id}'`), /check constraint/)
    await db.exec(`update music_tracks set lyrics_type='synced',synced_lyrics='[{"start":0,"end":5,"text":"Line"}]' where id='${track.id}'`)
    assert.equal((await db.query(`select lyrics from music_tracks where id='${track.id}'`)).rows[0].lyrics,'Original text')
  })
  console.log(`${count} feature database checks passed`)
} finally { await db.close() }
