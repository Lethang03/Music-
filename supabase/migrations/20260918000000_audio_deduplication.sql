-- ============================================================================
-- SoundVerse Phase 3: Audio Deduplication System Migration
-- Migration: 20260918000000_audio_deduplication.sql
-- ============================================================================

-- 1. Table: music_tracks
ALTER TABLE music_tracks
  ADD COLUMN IF NOT EXISTS audio_hash TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS audio_mime_type TEXT DEFAULT 'audio/mpeg';

CREATE INDEX IF NOT EXISTS idx_music_tracks_audio_hash
  ON music_tracks(audio_hash)
  WHERE audio_hash IS NOT NULL;

-- 2. Table: episodes
ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS audio_hash TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT;

CREATE INDEX IF NOT EXISTS idx_episodes_audio_hash
  ON episodes(audio_hash)
  WHERE audio_hash IS NOT NULL;

-- 3. Table: import_jobs
ALTER TABLE import_jobs
  ADD COLUMN IF NOT EXISTS source_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_import_jobs_source_hash
  ON import_jobs(source_hash)
  WHERE source_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_import_jobs_source_hash_status
  ON import_jobs(source_hash, status)
  WHERE source_hash IS NOT NULL;

