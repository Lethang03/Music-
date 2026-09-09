# Service Worker & Admin Loading Fix Report

## 1. Root Cause Analysis
The issue where the Admin page hangs on "Loading page..." was caused by a combination of two distinct but interacting bugs:
1. **Ghost Service Worker (`sw.bundle.js`)**: A legacy service worker, likely registered by a previous configuration such as `vite-plugin-pwa`, remained active in the browser. During Playwright test runs, this stale service worker aggressively intercepted network requests (like Vite's dynamic `import()` for lazy-loaded chunks like `AdminPage.jsx`). Because it lacked the proper handlers for these requests, the `fetch` promises were trapped in an indefinitely pending state or failed outright (`Uncaught (in promise) TypeError: Failed to fetch at sw.bundle.js`), preventing `Suspense` from ever resolving.
2. **Unhandled Promise Rejections in Admin Components**: If the chunk *did* load but a Supabase query failed (e.g. network failure), the internal data-loading functions (like `loadTracks` in `AdminMusic.jsx`) did not wrap the `await supabase.from()` calls in `try/catch/finally` blocks. This resulted in `setLoading(false)` being completely skipped, keeping the components permanently stuck in their internal "Loading tracks..." or "Loading podcasts..." states without displaying the error UI.

## 2. Implemented Fixes

### Service Worker Registration (`src/main.jsx`)
- Overhauled the Service Worker registration lifecycle.
- **Aggressive Unregistration**: Added logic to call `navigator.serviceWorker.getRegistrations()` and forcibly `unregister()` any active service workers if the environment is `DEV`, `TEST`, or running under `Playwright` (`window.navigator.userAgent.includes('Playwright')`).
- Also catches any rogue service worker URLs (like `sw.bundle.js`) that do not explicitly end in `/sw.js` and unregisters them safely.

### Admin Data Loading (`src/features/admin/components/*`)
Audited and rewrote the data-fetching logic for all Admin modules to guarantee that the loading state always finishes, ensuring errors are surfaced to the UI rather than hanging indefinitely:
- **`AdminMusic.jsx` (`loadTracks`)**: Wrapped in `try/catch/finally`. `setLoading(false)` is now guaranteed to execute.
- **`AdminEpisodes.jsx` (`loadData`)**: Consolidated `Promise.all` into a `try/catch/finally` block. `eps.error` and `pods.error` now strictly `throw` to trigger the `catch` block and display the error banner.
- **`AdminPodcasts.jsx` (`loadPodcasts`)**: Wrapped in `try/catch/finally`.
- **`AdminUsers.jsx` (`loadUsers`)**: Wrapped in `try/catch/finally`.
- **`AdminMusicImport.jsx` (`loadJobs`)**: Added `try/catch` wrapper to handle background polling query failures without producing uncaught promise rejections.

## 3. UI and System Impact
- **UI & Layout**: No visual changes were made. Error banners (`<div className="v2-status-banner error" role="alert">`) that already existed in the DOM now correctly render when the state is populated.
- **Player & Podcasts**: Left untouched.
- **Playwright Testing**: The aggressive SW unregistration logic specifically looks for `Playwright` in the user agent, ensuring headless test environments always hit the live development server without stale cache interference. Test `v2.spec.js:249` should now pass normally after clearing browser storage.

