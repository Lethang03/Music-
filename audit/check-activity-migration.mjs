import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const migration = readFileSync('supabase/migrations/20260908000000_soundverse_activity.sql', 'utf8').replace(/^\uFEFF/, '')
const completion = readFileSync('supabase/migrations/20260907_soundverse_completion.sql', 'utf8')
const owner = '11111111-1111-4111-8111-111111111111'
const other = '11111111-1111-4111-8111-111111111112'
for (const existing of [false, true]) {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated;
      insert into auth.users values ('${owner}'),('${other}');`)
    if (existing) await db.exec(completion.slice(completion.indexOf('create table if not exists public.soundverse_activity'), completion.indexOf('alter table public.music_tracks add column')))
    await db.exec(migration)
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);
      insert into public.soundverse_activity(user_id,media_key,item,liked,listening_days)
      values('${owner}','track:test','{}',true,'{}'); reset role;`)
    await db.exec(migration)
    assert.equal((await db.query('select * from public.soundverse_activity')).rows.length, 1)
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);
      insert into public.soundverse_activity(user_id,media_key,item,liked) values('${owner}','track:test','{}',false)
      on conflict(user_id,media_key) do update set liked=excluded.liked;`)
    assert.equal((await db.query('select liked from public.soundverse_activity')).rows[0].liked, false)
    await db.exec(`reset role; create policy legacy_open on public.soundverse_activity for all to authenticated using(true) with check(true);
      set role authenticated; select set_config('request.jwt.claim.sub','${other}',false);`)
    assert.equal((await db.query('select * from public.soundverse_activity')).rows.length, 0)
    await assert.rejects(db.exec(`insert into public.soundverse_activity(user_id,media_key,item) values('${owner}','track:attack','{}');`), /row-level security/i)
    console.log(`PASS activity migration: ${existing ? 'existing completion schema' : 'missing table'}, reapplication, upsert, owner isolation`)
  } finally { await db.close() }
}
