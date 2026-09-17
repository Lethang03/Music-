-- ============================================================================
-- SoundVerse Phase 3: Audio Deduplication System Migration
-- Document: PHASE3_DATABASE_MIGRATION.sql
-- Non-destructive migration: preserves all existing data and tables.
-- ============================================================================

-- 1. Table: music_tracks
-- Add content hash, file size, and mime type for audio deduplication & storage metrics
ALTER TABLE music_tracks
  ADD COLUMN IF NOT EXISTS audio_hash TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS audio_mime_type TEXT DEFAULT 'audio/mpeg';

-- Index on music_tracks(audio_hash) for fast O(1) deduplication lookups
CREATE INDEX IF NOT EXISTS idx_music_tracks_audio_hash
  ON music_tracks(audio_hash)
  WHERE audio_hash IS NOT NULL;

-- 2. Table: episodes
-- Add content hash and file size for podcast episode audio deduplication
ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS audio_hash TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Index on episodes(audio_hash) for fast O(1) deduplication lookups
CREATE INDEX IF NOT EXISTS idx_episodes_audio_hash
  ON episodes(audio_hash)
  WHERE audio_hash IS NOT NULL;

-- 3. Table: import_jobs
-- Add source URL hash for deduplicating incoming import requests (pending, processing, completed)
ALTER TABLE import_jobs
  ADD COLUMN IF NOT EXISTS source_hash TEXT;

-- Index on import_jobs(source_hash) for instant duplicate job detection
CREATE INDEX IF NOT EXISTS idx_import_jobs_source_hash
  ON import_jobs(source_hash)
  WHERE source_hash IS NOT NULL;

-- Index for combined state check (source_hash + status)
CREATE INDEX IF NOT EXISTS idx_import_jobs_source_hash_status
  ON import_jobs(source_hash, status)
  WHERE source_hash IS NOT NULL;

COMMENT ON COLUMN music_tracks.audio_hash IS 'SHA-256 hash of the converted audio stream for deduplication';
COMMENT ON COLUMN music_tracks.file_size IS 'Byte size of the stored audio stream';
COMMENT ON COLUMN music_tracks.audio_mime_type IS 'MIME type of the audio stream (default audio/mpeg)';
COMMENT ON COLUMN episodes.audio_hash IS 'SHA-256 hash of the converted audio stream for deduplication';
COMMENT ON COLUMN episodes.file_size IS 'Byte size of the stored audio stream';
COMMENT ON COLUMN import_jobs.source_hash IS 'SHA-256 hash of the normalized source URL to prevent duplicate import jobs';

