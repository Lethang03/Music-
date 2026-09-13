# V2 DATABASE SCHEMA

*Note: V2 reuses the V1 Supabase PostgreSQL database to ensure data continuity.*

## Core Tables

### `profiles`
- `id` (uuid, PK, matches auth.users)
- `display_name` (text)
- `email` (text)
- `avatar_url` (text)
- `created_at` (timestamp)

### `music_tracks`
- `id` (uuid, PK)
- `owner_id` (uuid, FK to auth.users; nullable)
- `title` (text)
- `artist` (text)
- `album` (text)
- `genre` (text)
- `audio_url` (text)
- `cover_url` (text)
- `image_url` (text, legacy artwork fallback)
- `duration` (integer)
- `release_date` (date)
- `track_number` (integer)
- `description` (text)
- `explicit_content` (boolean)
- `lyrics` (text, plain lyrics)
- `lyrics_type` (text: `plain` or `synced`)
- `synced_lyrics` (jsonb array)
- `import_job_id` (uuid, FK to import_jobs; nullable)
- `published` (boolean)
- `created_at` (timestamp)

### `podcasts`
- `id` (uuid, PK)
- `title` (text)
- `author` (text)
- `description` (text)
- `image` (text)
- `published` (boolean)

### `episodes`
- `id` (uuid, PK)
- `podcast_id` (uuid, FK)
- `title` (text)
- `description` (text)
- `audio_url` (text)
- `duration` (integer)
- `published_at` (timestamp)

### `playlists`
- `id` (uuid, PK)
- `user_id` (uuid, FK)
- `name` (text)

*(More tables mapped via Supabase as needed)*
