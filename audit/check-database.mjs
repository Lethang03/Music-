import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
const db = new PGlite()
const u1='11111111-1111-4111-8111-111111111111',u2='11111111-1111-4111-8111-111111111112'
const track='22222222-2222-4222-8222-222222222221', draft='22222222-2222-4222-8222-222222222222'
const playlist='55555555-5555-4555-8555-555555555555',pod='33333333-3333-4333-8333-333333333333'
const checks=[]
async function check(name, fn) { await fn(); checks.push(name); console.log('PASS',name) }
const actor=async (id, admin=false, role='authenticated') => {
 await db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',false); select set_config('request.jwt.claims','{"app_metadata":{"role":"${admin ? 'admin':'user'}"}}',false); set role ${role};`)
}
try {
 await check('full migration sequence bootstraps an empty public schema', async () => {
   const fresh = new PGlite()
   try {
     await fresh.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema storage;
       create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
       create table storage.buckets(id text primary key, name text, public boolean default false);
       create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
       create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
       create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
       grant usage on schema public,auth to anon,authenticated;`)
     for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${file}`, 'utf8').replace(/^\uFEFF/, ''))
     await fresh.exec(`insert into auth.users(id,email,raw_user_meta_data) values ('${u1}','existing@example.test','{"display_name":"existing"}');`)
     assert.equal((await fresh.query('select display_name from profiles')).rows[0].display_name, 'existing')
     assert.equal((await fresh.query('select * from soundverse_activity')).rows.length, 0)
   } finally { await fresh.close() }
 })
 await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
 create table storage.buckets(id text primary key, name text, public boolean default false);
 create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 grant usage on schema public,auth to anon,authenticated;
 grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
 insert into auth.users(id) values ('${u1}'),('${u2}');
 create table public.profiles(id uuid primary key references auth.users, display_name text, avatar_url text,bio text,role text default 'user',created_at timestamptz default now());
 create table public.music_tracks(id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users,title text,artist text,album text,cover_url text,audio_url text,published boolean default false,created_at timestamptz default now());
 create table public.podcasts(id uuid primary key default gen_random_uuid(),owner_id uuid references auth.users,title text,description text,author text,category text,cover_url text,published boolean default false,created_at timestamptz default now());
 create table public.episodes(id uuid primary key default gen_random_uuid(),podcast_id uuid references public.podcasts,title text,description text,audio_url text,duration int,season_number int,episode_number int,published boolean default false,published_at timestamptz,created_at timestamptz default now());
 create table public.playlists(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users,name text not null,created_at timestamptz default now());
 create table public.favorites(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users);
 grant all on all tables in schema public to anon,authenticated;
 insert into public.profiles(id,display_name) values ('${u1}','One'),('${u2}','Two');
 insert into public.favorites(user_id) values ('${u1}'),('${u2}');
 alter table public.favorites enable row level security;
 create policy old_permissive on public.favorites for all to anon,authenticated using (true) with check (true);
 insert into public.music_tracks(id,title,published) values ('${track}','Published',true),('${draft}','Draft',false);
 insert into public.podcasts(id,title,published) values ('${pod}','Draft podcast',false);
 insert into public.episodes(podcast_id,title,published) values ('${pod}','Hidden by parent',true);
 alter table public.profiles enable row level security;
 create policy old_permissive on public.profiles for all to anon,authenticated using (true) with check (true);
 alter table public.playlists enable row level security;
 create policy old_permissive on public.playlists for all to anon,authenticated using (true) with check (true);
 `)
 for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) {
   await check(`migration applies: ${file}`,()=>db.exec(readFileSync(`supabase/migrations/${file}`,'utf8').replace(/^\uFEFF/, '')))
 }
 await check('signup trigger creates a profile without an email column', async () => {
   await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values ('11111111-1111-4111-8111-111111111113','new@example.test','{"display_name":"New listener","role":"admin"}');`)
   assert.equal((await db.query("select display_name,role from profiles where id='11111111-1111-4111-8111-111111111113'")).rows[0].display_name, 'New listener')
   assert.equal((await db.query("select role from profiles where id='11111111-1111-4111-8111-111111111113'")).rows[0].role, 'user')
 })
 await check('all migrations can be reapplied without deleting profiles', async () => {
   for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8').replace(/^\uFEFF/, ''))
   assert.equal((await db.query('select * from profiles')).rows.length, 3)
 })
 await actor('',false,'anon')
 await check('anonymous users cannot read profiles',async()=>assert.equal((await db.query('select * from profiles')).rows.length,0))
 await check('anonymous users cannot read legacy favorites',async()=>assert.equal((await db.query('select * from favorites')).rows.length,0))
 await check('anonymous users see only published tracks',async()=>assert.equal((await db.query('select * from music_tracks')).rows.length,1))
 await check('published episodes under draft podcasts are hidden',async()=>assert.equal((await db.query('select * from episodes')).rows.length,0))
 await actor(u1)
 await check('legacy favorites are isolated despite old permissive policies',async()=>assert.equal((await db.query('select * from favorites')).rows.length,1))
 await check('existing permissive profile policy cannot expose other users',async()=>assert.equal((await db.query('select * from profiles')).rows.length,1))
 await check('profile upsert succeeds using only editable fields',()=>db.exec(`insert into profiles(id,display_name,username,avatar_url,bio) values ('${u1}','Updated','listener_one',null,'Hello') on conflict(id) do update set id=excluded.id, display_name=excluded.display_name,username=excluded.username,avatar_url=excluded.avatar_url,bio=excluded.bio;`))
 await check('profile role escalation is denied',()=>assert.rejects(()=>db.exec(`update profiles set role='admin' where id='${u1}'`),/permission denied/i))
 await check('profile of another user cannot be changed',async()=>assert.equal((await db.query(`update profiles set display_name='Attack' where id='${u2}' returning id`)).rows.length,0))
 await check('owned playlist saves and reorders atomically',()=>db.exec(`insert into playlists(id,user_id,name,track_ids) values('${playlist}','${u1}','My playlist',array['${track}']::uuid[]); update playlists set track_ids=array['${track}']::uuid[] where id='${playlist}';`))
 await check('unavailable track IDs cannot be added',()=>assert.rejects(()=>db.exec(`update playlists set track_ids=array['${draft}']::uuid[] where id='${playlist}'`),/unavailable/i))
 await check('playlist cannot be reassigned to another user',()=>assert.rejects(()=>db.exec(`update playlists set user_id='${u2}' where id='${playlist}'`),/row-level security/i))
 await check('owned activity can be saved',()=>db.exec(`insert into soundverse_activity(user_id,media_key,item,liked) values('${u1}','track:${track}','{"id":"${track}","title":"Published"}',true);`))
 await check('non-admin catalog writes are denied',()=>assert.rejects(()=>db.exec(`insert into music_tracks(title,published) values('Attack',true)`),/row-level security/i))
 await actor(u2)
 await check('second account cannot read first account playlists or activity',async()=>{
   assert.equal((await db.query('select * from playlists')).rows.length,0)
   assert.equal((await db.query('select * from soundverse_activity')).rows.length,0)
 })
 await check('second account cannot overwrite first account activity',()=>assert.rejects(()=>db.exec(`insert into soundverse_activity(user_id,media_key,item) values('${u1}','track:${track}','{}') on conflict(user_id,media_key) do update set item=excluded.item`),/row-level security/i))
 await actor(u1,true)
 await check('server-managed admin sees draft content and can publish',async()=>{
   assert.equal((await db.query('select * from music_tracks')).rows.length,2)
   assert.equal((await db.query(`update music_tracks set published=true where id='${draft}' returning id`)).rows.length,1)
 })
 writeFileSync('audit/database-results.json',JSON.stringify({ engine:'PGlite PostgreSQL', baseline:'Representative schema matching observed columns, not a live database clone', passed:checks },null,2))
 console.log(`${checks.length} database checks passed`)
} catch (error) { console.error('Database check failed:', error.message, error.detail || '', 'position:', error.position || ''); process.exitCode = 1 } finally { await db.close() }
