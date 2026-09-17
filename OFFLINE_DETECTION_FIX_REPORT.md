# SoundVerse offline detection and recovery

## Root cause

The reported full-screen wording came from `public/offline.html`, not a Supabase error handler in React. `public/sw.js` caught every rejected same-origin navigation fetch and served that static document. Its heading unconditionally said offline, and its button unconditionally reloaded. A rejected navigation can also mean an origin/network-path failure while the browser remains online. There were no browser connectivity listeners or automatic catalog/profile recovery in the React app.

The worker also used global `caches.match`, allowing an older matching fallback to be selected. Registration in `src/main.jsx` attached a load listener after asynchronous cleanup, potentially missing load entirely. Existing API failures already had separate error banners.

## Files changed

- `src/contexts/ConnectivityContext.jsx`: browser connectivity state, recovery counter, offline overlay, online/offline and resume listeners.
- `src/App.jsx`: places connectivity provider above auth; existing app/provider tree remains mounted.
- `src/contexts/AuthContext.jsx`: retries profile loading after recovery.
- `src/contexts/LibraryContext.jsx`: retries catalog loading after recovery using existing cancellation and request guards.
- `src/main.jsx`: registers immediately if load already finished; bypasses HTTP cache for worker update checks.
- `public/sw.js`: versioned fallback cache v3, current-cache-only lookup, fresh fallback installation and immediate worker activation.
- `public/offline.html`: connectivity-aware standalone fallback and automatic/manual recovery.
- `tests/offline.spec.js`: eight regression tests.
- This report.

## Detection and recovery

Offline is exclusively `navigator.onLine === false`. Browser online/offline events recheck that value rather than trusting the event name. API responses and exceptions never set connectivity state.

An offline-to-online transition removes the overlay and triggers catalog and profile loads. Try again remains offline when the browser is offline; otherwise it triggers the same recovery. While requests run, normal loading/error UI is available. A failed retry remains an API error, not an offline screen. Pageshow and visibility restoration also recheck connectivity for suspended mobile tabs.

No route changes, provider keys, audio resets, pauses, or app reloads are introduced in React recovery. Existing buffered playback can continue. No changes were made to GlobalPlayer, AudioContext, playback diagnostics, queue, Media Session, lyrics, or podcast playback. Pre-existing user changes in the audio files were preserved.

## Service worker findings

Navigation remains network-first. HTTP error responses pass through; only rejected navigation fetches use the fallback. Auth/API/storage/audio/Range requests and assets are not intercepted. The fallback itself checks browser connectivity and shows a neutral load error while online. It probes the original URL without cache and verifies the returned document contains the app root before navigating back to the same URL. This standalone document has no mounted React application, so document navigation is necessary here; there is no unconditional reload loop.

The new cache version, fresh install request, skipWaiting, clients.claim, and scoped cache lookup prevent selection of an older fallback after the updated worker installs. The fallback also requests a worker update. An already installed old document cannot retroactively gain this code before the browser obtains the update. Tests simulate stale fallback delivery and exercise worker handlers; they do not certify deployment/update timing on every installed mobile PWA.

## API errors

Existing library error banners and Retry remain inside the app shell. Profile failures retain their separate error handling. HTTP 500 and an aborted Edge Function request are covered by regression tests; neither changes offline state. The Edge Function test exercises a failed browser request, not a specific admin operation.

## Verification

- `npm run build`: passed. Vite reports its chunk-size advisory for the main bundle.
- `npm run lint`: passed.
- `npx playwright test tests/offline.spec.js tests/v2.spec.js --workers=1 --reporter=list`: all 31 existing V2 tests passed. One new fallback test initially failed and exposed a document-detection retry loop, which was fixed in implementation.
- `npx playwright test tests/offline.spec.js --workers=1 --reporter=list`: all 8 tests passed after the fix, including two additional startup/stale-fallback scenarios.
- Existing tests were not modified. Test-generated tracked screenshots/temp changes were restored.

Coverage includes online success, initial offline state, offline Try again, manual and automatic recovery, catalog/profile refetches, original route, continued playback and identical audio element, Supabase 500 recovery, Edge Function failure, connectivity-aware standalone fallback, stale fallback recovery, and network-first/current-cache worker behavior.

Initial sandbox verification could not spawn esbuild; build and browser tests succeeded with approved process permissions.

## Mobile considerations

The offline overlay uses dynamic viewport height through its fixed viewport bounds and leaves the audio provider alive. Visibility/pageshow checks catch connectivity changes after app suspension. The existing responsive and podcast/playback tests passed. Physical-device lock-screen behavior was not newly tested for this change. Browser onLine is the requested source of truth; it is a connectivity hint and does not prove that every Internet host is reachable.
