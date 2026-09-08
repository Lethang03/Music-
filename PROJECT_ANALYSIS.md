# Project analysis

Audited project: `E:\Music GG`, package `music-gg-v2` 2.0.0. All generated code and evidence stay in this directory.

## Architecture and stack
React 18 client SPA with React Router 6, Vite 5, lucide-react, hand-written CSS and inline component style blocks. AuthContext owns Supabase sessions/profiles; LibraryContext loads catalogs and user collections; AudioContext owns the HTML audio player. AppShell provides sidebar, topbar, mobile navigation and a global/fullscreen player. Features cover landing/auth, home, music, podcasts/detail, search, library, profile, settings and administration. No server, deployed migrations, CI or functional lint configuration were present. Playwright was installed but tests had invalid sessions, obsolete storage fields and incorrect selectors.

## Strengths
Existing coherent visual system, persistent shell, single-player intent, routed podcast pages with season UI, Supabase SDK authentication, lazy artwork on browse pages, error boundary, and lockfile.

## Baseline weaknesses and risks
- Audio instantiated during render with no source teardown; queue removal shifts the selected item; equal IDs prevent duplicate-entry advancement; repeat-all with one item cannot restart; persistence writes the full queue every timeupdate; media errors are console-only.
- Profile invokes absent fetchProfile; settings invoke absent handlers; genre/category filters only change highlighting; homepage fabricates continue-listening progress; playlist playback, favorites, history and admin actions are placeholders.
- Auth can hang on a rejected initial session; logout ignores returned errors; user-specific library state survives sign-out; async results lack cancellation.
- Eager routes produce a 526.11 kB entry bundle. Inline global CSS selectors can affect unrelated pages.
- No checked-in RLS/storage policies. Hiding admin navigation does not protect the route or database. Public key is expected in a SPA; service-role keys must never be bundled.

## Live backend observations (2026-09-07)
Read-only requests with configured public key succeed. music_tracks columns: id, owner_id, title, artist, album, cover_url, audio_url, youtube_url, source_type, published, created_at. No genre/duration columns. podcasts include category, cover_url, visibility and published. episodes include podcast_id, season_number, episode_number, published and published_at. profiles include display_name, avatar_url, bio and role, but not email. Anonymous profile query returned a row (only column names were inspected/recorded). playlists and favorites exist; playlist_tracks, history and settings return PGRST205. Table presence/empty results do not prove RLS security. Privileged database policy inspection and two real accounts are needed for live isolation verification.

## Verification approach
Build and lint, deterministic browser REST fixtures separate from real backend, real local WAV media ending naturally, queue/repeat/shuffle regressions, error and account-isolation checks, persistence flows, seven requested viewport sizes and rendered screenshots. Fixtures are confined to tests; no fake data enters the application. Live auth, write permissions and migrations cannot be certified by fixture tests.

## Security references
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/users
- https://supabase.com/docs/reference/javascript/auth-onauthstatechange
