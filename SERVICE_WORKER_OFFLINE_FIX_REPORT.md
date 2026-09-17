# Production service worker false-offline fix

## Root cause and observed evidence

The existing `public/sw.js` navigation handler (line 15 at the start of this task) used `fetch(request).catch(...)` to immediately return cached `offline.html`. There was no cached app-shell response between a failed fetch and that fallback. A navigation could therefore show a 200 document served by ServiceWorker while the underlying fetch failed, exactly as in the supplied Network-panel evidence. The 200 described the cached fallback response, not a successful request to the origin. This does not establish why the origin fetch failed or prove that the device lost Internet connectivity.

The earlier fix made the fallback wording connectivity-aware but did not provide cached application navigation. This change fixes that missing strategy.

## Navigation behavior

1. Request the navigation from the network.
2. Return any HTTP response unchanged, including 401, 403, 404, 500 and 503. Best-effort caching cannot turn a successful fetch into the fallback.
3. If fetch rejects, return a validated cached app shell at the canonical `/` key. The address bar and requested route remain unchanged.
4. Only if no valid shell exists AND worker `navigator.onLine === false`, return cached `offline.html`.
5. If online with no usable shell, return an uncached neutral 503 page: “SoundVerse could not be loaded.” Its Try again retries document navigation. A subsequent online event retries automatically. No React/audio session exists in this standalone error document.

Shell validation requires status 200, non-opaque/non-redirected response, HTML content type, an actual root div and a Vite `/assets/` script. Error documents and fake-200 fallback pages cannot poison the shell cache. Offline HTML keeps its existing browser connectivity check and successful-document recovery.

## PWA caching and updates

- New version: `soundverse-v2-cache-v4`.
- Install refreshes the fallback and attempts to warm the public static app shell plus its directly referenced JS/CSS assets. It saves that install shell only after those asset requests succeed.
- Same-origin hashed Vite JS/CSS assets use cache-first with network fallback. Only successful, non-opaque, non-redirected JavaScript/CSS responses are cached. Lazy chunks become available offline after being fetched; this does not promise that every unvisited route is available offline.
- Navigations stay network-first. Runtime valid navigation responses refresh the canonical shell.
- Activate deletes old SoundVerse cache namespaces. Before deletion it preserves valid immutable JS/CSS for existing tabs and, if the new shell was unavailable, a validated older shell. Old offline documents are never migrated as the app shell. Unrelated application caches are untouched.
- `skipWaiting()` and `clients.claim()` remain compatible here: this worker handles public shell/assets only and does not reload existing tabs or intercept audio/API requests. Preserving old immutable assets helps open tabs keep using their loaded build. These retained assets remain subject to browser storage quotas.
- Existing registration already uses `updateViaCache: 'none'`; it remains unchanged in this task.

## Preserved behavior

Non-GET, cross-origin, Range, and ordinary non-navigation API/media requests bypass the worker. Supabase, Edge Functions, CORS request failures and API 4xx/5xx never modify connectivity. No private API data or audio is added to Cache Storage.

No playback, queue, lyrics, background audio, Media Session, Supabase client, Admin, or Docker worker implementation was edited in this task. Existing React offline-to-online recovery continues retrying profile/catalog loads without remounting the audio provider.

## Files changed in this task

- `public/sw.js`: navigation fallback strategy, shell/assets cache and update lifecycle.
- `tests/service-worker.spec.js`: worker contract tests and an actual Chrome worker/socket-failure test.
- `tests/offline.spec.js`: updated the existing worker test double to include browser connectivity, headers, and realistic Response objects. Original error pass-through and API/audio bypass assertions remain; offline fallback now explicitly requires offline state. No V2 tests were edited.
- This report.

Earlier offline-recovery changes and unrelated user changes were preserved.

## Verification

- `npm run build`: passed; Vite retains the main-bundle size advisory.
- `npm run lint`: passed.
- `git diff --check`: passed.
- Focused offline suite: 8 passed.
- Final service-worker suite: 13 passed, including real Chrome navigation failure while online, cached JS execution, true offline shell navigation, no-shell offline fallback, and automatic recovery at the same route.
- `npx playwright test tests/v2.spec.js --workers=1 --reporter=list`: 31 passed in the isolated final run (2.4 minutes), including both cases that failed during the overlapping run.

Worker tests also cover HTTP error pass-through, opaque/fake-200 rejection, temporary API failure bypass, cache storage failure, cache cleanup and claim/skipWaiting, retained old assets, and install network failure preserving an older valid shell.

An initial overlapping V2 run finished with 29 passes, a missing Playwright trace file during context cleanup, and a responsive-page timeout. The shared output directory explains the trace failure; the timeout's cause was not established. The V2 suite was rerun alone without changing application assertions.

## Deployment scope

Implemented and verified locally. The production Netlify site was not deployed or modified. Existing installations receive the fix after the updated worker is deployed and installed. An old already-loaded offline document cannot gain new code before a browser update/navigation obtains it. The real-worker test uses the exact worker source with a small static shell on a local HTTP server; it does not claim live Netlify or physical-device certification.
