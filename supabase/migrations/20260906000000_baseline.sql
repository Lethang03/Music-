-- Bootstrap missing core tables. Existing tables and records are preserved.
begin;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text, avatar_url text, bio text, created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
create table if not exists public.music_tracks (
 id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id) on delete set null,
 title text not null, artist text, album text, cover_url text, audio_url text,
 published boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.podcasts (
 id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id) on delete set null,
 title text not null, description text, author text, category text, cover_url text,
 published boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.episodes (
 id uuid primary key default gen_random_uuid(), podcast_id uuid not null references public.podcasts(id) on delete cascade,
 title text not null, description text, audio_url text, duration integer,
 season_number integer, episode_number integer, published boolean not null default false,
 published_at timestamptz not null default now(), created_at timestamptz not null default now()
);
-- Default-deny until the following migration installs explicit policies.
alter table public.profiles enable row level security;
alter table public.music_tracks enable row level security;
alter table public.podcasts enable row level security;
alter table public.episodes enable row level security;
grant select on public.music_tracks, public.podcasts, public.episodes to anon, authenticated;
commit;
