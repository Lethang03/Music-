# FEATURE AUDIT - V2 Application

## AUTH
- Feature: Login/Register
  Current: UI exists and calls Supabase.
  Status: ✅ Working

## PROFILE
- Feature: Profile Statistics
  Current: Hardcoded values (1,240 mins, 42 liked, 5 followed).
  Status: ❌ Broken (Fake Data)
  Required: Implement real stats based on history and favorites.

- Feature: Profile Edit / Save
  Current: Non-existent. Only displays name/email.
  Status: 🚧 Not Implemented
  Required: Create profile edit form (avatar, display name) and update Supabase.

## ACCOUNT / SETTINGS
- Feature: Account Settings Button
  Current: Exists on Profile page, does nothing.
  Status: ❌ Broken
  Required: Implement Settings page (Volume, Playback, Appearance, Delete Account).

## MUSIC
- Feature: Genre Filter
  Current: Pills exist in MusicLibrary but do not filter data.
  Status: ❌ Broken (Fake UI)
  Required: Implement real filtering or remove if genres aren't in schema.

- Feature: Track Action Menu
  Current: Non-existent (no "..." menu on cards).
  Status: 🚧 Not Implemented
  Required: Implement Play, Play Next, Add to Queue, Add to Playlist, Like.

## PODCAST
- Feature: Podcast Detail & Playback
  Current: Fetches episodes, plays via AudioContext.
  Status: ✅ Working

- Feature: Podcast Progress
  Current: LocalStorage only, no Supabase sync.
  Status: ⚠️ Partial
  Required: Sync progress to backend.

- Feature: Podcast Category Filter
  Current: Pills exist in PodcastBrowse but do not filter data.
  Status: ❌ Broken (Fake UI)
  Required: Implement real filtering or remove.

## PLAYER
- Feature: Queue Drag and Drop
  Current: Queue renders but cannot be reordered.
  Status: 🚧 Not Implemented
  Required: Implement DND reordering.

## PLAYLIST
- Feature: Playlist Creation
  Current: "Create New" card exists in Library but does nothing.
  Status: ❌ Broken
  Required: Implement creation modal, Supabase insert.

- Feature: Playlist Read / Play
  Current: Renders placeholder icon. No track fetching.
  Status: ⚠️ Partial
  Required: View playlist tracks, play/queue playlist.

- Feature: Playlist Management
  Current: No edit, delete, or track management.
  Status: 🚧 Not Implemented
  Required: Add/remove songs, rename, delete.

## LIBRARY
- Feature: Listening History
  Current: UI maps `history` array from context but no click handlers to play.
  Status: ⚠️ Partial
  Required: Make history items clickable, fetch rich metadata.

## LIKE / FAVORITE
- Feature: Like Button
  Current: Non-existent.
  Status: 🚧 Not Implemented
  Required: Implement heart button across app, sync to `favorites` table.

## SEARCH
- Feature: Global Search
  Current: Basic client-side filtering on pre-loaded tracks.
  Status: ⚠️ Partial
  Required: Implement debounce, loading states, empty states, across all entities.

## ADMIN
- Feature: Admin CRUD
  Current: Music/Podcast basic tables exist.
  Status: ⚠️ Partial
  Required: Ensure Edit/Delete work.

- Feature: File Upload
  Current: Buttons exist but no upload handler.
  Status: ❌ Broken
  Required: Implement Supabase Storage upload for audio and cover images.

## ERROR HANDLING
- Feature: Global loading/success/error states
  Current: Partial.
  Status: ⚠️ Partial
  Required: Add explicit states to all data-mutating actions (Save profile, Create playlist).

