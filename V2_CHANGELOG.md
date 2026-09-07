# V2 Changelog

## [2.4.0] — 2026-09-07 — Full QA/Debug Audit Pass

### 🔴 CRITICAL FIXES

#### ROOT CAUSE: Blank Screen — Auth Loading Never Resolves
- **File**: `src/contexts/AuthContext.jsx`
- **Bug**: When `session` existed but `profiles` table returned no row (first login, unprovisioned account), `setLoading(false)` was never called → app permanently blank.
- **Fix**: `try/catch/finally` in `fetchProfile()` ensures `setLoading(false)` is always called. Added 5-second safety timeout. If no profile row exists, synthesize minimal profile from `session.user` email.

#### ROOT CAUSE: Audio Auto-Next Stale Closure
- **File**: `src/contexts/AudioContext.jsx`  
- **Bug**: The `ended` event listener registered a stale closure of `handleNext` capturing `queue` and `currentIndex` at mount time. After queue changes, the listener still called `handleNext` with the wrong data.
- **Fix**: Complete AudioContext rewrite. All event handlers use `useRef` mirrors (`queueRef`, `currentIndexRef`, `shuffleRef`, `repeatRef`) — guaranteed fresh reads from inside listeners. Single `Audio()` instance, guarded with `if (!audioRef.current)`.

#### ROOT CAUSE: Now Playing Covered Topbar/Sidebar  
- **File**: `src/components/player/GlobalPlayer.jsx`
- **Bug**: NowPlaying used `position: fixed; inset: 0` — covered topbar and sidebar entirely.
- **Fix**: Constrainted to `top: var(--topbar-height); left: var(--sidebar-width); right: 0; bottom: var(--player-height)`. Mobile: `top: 0; bottom: var(--mobile-nav-height)`. Tablet: `left: 0`.

#### ROOT CAUSE: Page Content Hidden Behind Player Bar
- **File**: `src/components/layout/AppShell.jsx`
- **Bug**: `.v2-main-content` had no `padding-bottom` so last items scrolled under the fixed player.
- **Fix**: `padding-bottom: var(--player-height)` on desktop, `padding-bottom: calc(var(--player-height) + var(--mobile-nav-height))` on mobile.

#### ROOT CAUSE: Podcast Episodes Missing / Detail Page Missing
- **File**: `src/features/podcast/PodcastDetail.jsx`, `App.jsx`, `PodcastBrowse.jsx`
- **Bug**: The user could not view podcast episodes because the `PodcastDetail` page did not exist, the route `/podcasts/:id` was missing, and the cards in `PodcastBrowse` had no click handler. Additionally, `LibraryContext` was attempting to fetch all episodes globally without separating them by podcast.
- **Fix**: 
  - Created `PodcastDetail.jsx` which dynamically fetches episodes specifically for the selected `podcast_id`.
  - Added proper sorting by `season_number` and `episode_number`.
  - Added a season filter tab.
  - Wired up the Play button to build a playback queue containing only the episodes from the currently selected podcast/season.
  - Linked `PodcastBrowse` cards to `/podcasts/:id`.

#### ROOT CAUSE: Missing CSS Classes
- **Files**: Multiple pages used `.v2-animate-fade` and `.v2-page-loading` but they were never defined.
- **Fix**: Defined in `AppShell.jsx` CSS — always available to page children.

### ⚠️ STABILITY FIXES

- **App.jsx**: Added React `ErrorBoundary` class wrapping all providers. Prevents React errors from rendering blank screen — instead shows a branded error UI with Reload button.
- **App.jsx**: Replaced `<div className="v2-loading-screen">` with inline-styled branded spinner. Never requires CSS to be loaded to display.
- **App.jsx**: Added catch-all `<Route path="*">` → redirects unknown routes to HomePage instead of blank.
- **LibraryContext.jsx**: Each query now has individual error logging. `try/catch/finally` guarantees `setLoading(false)`.
- **GlobalPlayer.jsx**: Added mute toggle with `prevVolume` restoration. Volume persisted to `localStorage`.
- **GlobalPlayer.jsx**: Shuffle and Repeat buttons now functional and wired.
- **AudioContext.jsx**: Playback persistence (restore queue + position on refresh). `try/catch` around localStorage restore. Corrupted state cleared automatically.
- **AudioContext.jsx**: MediaSession API: metadata, play/pause/next/prev/seekto handlers.
- **HomePage.jsx**: Removed `Math.random()` from render — was causing React StrictMode hydration warnings.
- **BottomNav.jsx**: Fixed z-index conflict with GlobalPlayer on mobile.
- **Topbar.jsx**: Raised z-index to 55 to stay above NowPlaying panel (z-index: 40).

### UI FIXES (No Redesign)

- **MusicLibrary.jsx**: Added accessible genre filter pills with `role="tab"`, proper empty state.
- **PodcastBrowse.jsx**: Added category filter pills, hero banner, proper empty state.
- **HomePage.jsx**: Proper empty state when no content. Stable hero layout.

---

## [2.3.0] — Earlier Sessions (Summary)

### Audio Engine
- Fixed `handleNext` stale closure in `ended` event listener using `useRef`
- Added `queueRef` and `currentIndexRef` to break stale closure in auto-next

### UI Polish Pass
- Premium dark theme (Deep Navy `#0B0B13`, Purple/Pink gradients)
- AppShell: Sidebar + Topbar + GlobalPlayer layout
- HomePage: Split-screen hero section
- MusicLibrary: Pill filter nav, premium grid
- PodcastBrowse: Hero banner + grid
- GlobalPlayer: Mini bar with seek, volume, artwork

### Navigation
- Added Profile tab to BottomNav mobile
- Sidebar with NavLink active states

---

## KNOWN LIMITATIONS (Per QA Session)

- **PWA**: No service worker or web manifest yet
- **Admin Upload**: Audio/cover file upload UI pending (modal shell exists)
- **Podcast Progress Sync**: localStorage only; no Supabase write yet
- **Queue Drag-and-Drop**: Display works; drag reorder not implemented
- **Offline UI**: App doesn't crash offline but no explicit offline indicator
- **E2E Tests**: Playwright test suite written but cannot be run autonomously (environment PATH issue — run manually with `npx playwright test`)
