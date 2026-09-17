const CACHE_NAME = 'soundverse-v2-cache-v4';
const OFFLINE_URL = '/offline.html';
const SHELL_URL = '/';

async function validShell(response) {
  if (!response || response.status !== 200 || response.type === 'opaque' || response.redirected || !response.headers.get('content-type')?.includes('text/html')) return false;
  const html = await response.clone().text();
  return /<div\b[^>]*\bid=["']root["'][^>]*>/.test(html) && /<script\b[^>]*\bsrc=["']\/assets\//.test(html);
}

async function saveShell(response) {
  if (!await validShell(response)) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(SHELL_URL, response.clone());
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
    // Warm the static Vite shell and its entry assets, without caching user data.
    try {
      const shell = await fetch(new Request(SHELL_URL, { cache: 'reload' }));
      if (await validShell(shell)) {
        const html = await shell.clone().text();
        const assets = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(match => match[1]);
        await Promise.all(assets.map(async url => {
          const response = await fetch(new Request(url, { cache: 'reload' }));
          if (!validAsset(response)) throw new Error('App asset unavailable');
          await cache.put(url, response);
        }));
        await saveShell(shell);
      }
    } catch { /* An update can still supply the connectivity-aware fallback. */ }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Retain immutable assets referenced by already-open tabs before deleting old caches.
    const cache = await caches.open(CACHE_NAME);
    for (const name of await caches.keys()) {
      if (!name.startsWith('soundverse-') || name === CACHE_NAME) continue;
      const old = await caches.open(name);
      // A transient install fetch failure must not discard a usable older shell.
      if (!await validShell(await cache.match(SHELL_URL))) {
        const previousShell = await old.match(SHELL_URL);
        if (await validShell(previousShell)) await cache.put(SHELL_URL, previousShell);
      }
      for (const request of await old.keys()) {
        if (isAsset(new URL(request.url)) && !await cache.match(request)) {
          const response = await old.match(request);
          if (validAsset(response)) await cache.put(request, response);
        }
      }
      await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

function isAsset(url) {
  return url.origin === self.location.origin && /^\/assets\/[^/]+-[\w-]+\.(js|css)$/.test(url.pathname);
}
function validAsset(response) {
  return response && response.status === 200 && response.type !== 'opaque' && !response.redirected && /(?:javascript|text\/css)/i.test(response.headers.get('content-type') || '');
}
async function navigation(request) {
  try {
    const response = await fetch(request);
    // An HTTP error is still a network response. Cache failures must not hide it.
    try { await saveShell(response); } catch { /* Storage can be unavailable. */ }
    return response;
  } catch {
    let cache;
    try {
      cache = await caches.open(CACHE_NAME);
      const shell = await cache.match(SHELL_URL);
      if (await validShell(shell)) return shell;
    } catch { /* Fall through when storage is unavailable. */ }
    if (self.navigator.onLine === false) {
      try {
        const fallback = await cache?.match(OFFLINE_URL);
        if (fallback?.ok) return fallback;
      } catch { /* Return a recoverable error when no fallback was cached. */ }
    }
    // A server/path/CORS failure while online is not device-wide offline status.
    return new Response(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SoundVerse unavailable</title><body><h1>SoundVerse could not be loaded</h1><p>Please try again in a moment.</p><button onclick="if(navigator.onLine !== false) location.reload()">Try again</button><script>window.addEventListener('online', () => location.reload());</script></body></html>`, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Auth, API, audio (including Range requests) remain network-only.
  if (request.method !== 'GET' || request.headers.has('range') || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(navigation(request));
  } else if (isAsset(url)) {
    event.respondWith((async () => {
      let cache;
      try {
        cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (validAsset(cached)) return cached;
      } catch { /* Storage errors must not prevent network access. */ }
      const response = await fetch(request);
      try { if (validAsset(response)) await cache?.put(request, response.clone()); } catch { /* Best effort. */ }
      return response;
    })());
  }
});
