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
- `title` (text)
- `artist` (text)
- `album` (text)
- `audio_url` (text)
- `cover_url` (text)
- `duration` (integer)
- `published` (boolean)

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

