# SUPABASE DATABASE AUDIT REPORT

## 1. `profiles`
* **Status:** Existing (V1 Legacy).
* **Missing Feature:** The backend was missing the PostgreSQL trigger to automatically create a `profiles` row upon `auth.users` insertion.
* **Fix Applied:** 
  - Wrote a new migration (`20260908000001_auth_profile_trigger.sql`) containing the `handle_new_user()` trigger for `auth.users`.
  - Also added a robust client-side fallback in `AuthContext.jsx` that performs an `upsert` immediately upon login if the profile row is missing, entirely fixing the "Your profile could not be loaded" infinite error loop.

## 2. `music_tracks` (Tracks/Music)
* **Status:** Existing (V1 Legacy).
* **Audit:** The schema maps correctly to the client-side `LibraryContext` expectations. Fields (`audio_url`, `cover_url`, `title`, `artist`) are present.
* **RLS Policies:** Must be `SELECT` allowed for all users (if `published = true`).

## 3. `podcasts` & `episodes`
* **Status:** Existing (V1 Legacy).
* **Audit:** Schema matches exactly. The `podcast_id` foreign key correctly links episodes to their parent podcasts. 
* **RLS Policies:** Must be `SELECT` allowed for all users (if `published = true`).

## 4. `playlists`
* **Status:** Existing (V1 Legacy).
* **Audit:** Client side uses `playlists` table with fields `id`, `user_id`, `name`. `LibraryContext` correctly targets this table and isolates by `user_id`.
* **RLS Policies:** Needs `SELECT, INSERT, UPDATE, DELETE` where `auth.uid() = user_id`.

## 5. `soundverse_activity` (Handles History, Favorites, and Activity)
* **Status:** MISSING IN SCHEMA CACHE.
* **Root Cause:** V2 architecture consolidated "history", "favorites", and "playback position" into a unified syncing engine (`LibraryContext.jsx`), expecting a single `soundverse_activity` table to perform upserts against `(user_id, media_key)`. This table did not exist in the database.
* **Fix Applied:** 
  - Generated a definitive SQL migration file: `20260908000000_soundverse_activity.sql` to explicitly create this table.
  - Included exact JSONB payload columns (`item`, `listening_days`) mapping directly to the client's schema.
  - Created composite `UNIQUE(user_id, media_key)` constraint essential for the React `upsert` block.
  - Hardened with strict RLS: `auth.uid() = user_id` for all operations.

---
**ACTION REQUIRED FOR SUPABASE ADMIN:**
Please execute the two SQL migration files located in `supabase/migrations/` inside your Supabase SQL Editor to synchronize the schema cache.

