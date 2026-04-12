// CW WA7PGE — Service Worker
// Bump CACHE_VERSION when static assets change to force a cache refresh.
const CACHE_VERSION = 'cw-v2';

const STATIC_ASSETS = [
  '/static/js/jscwlib.js',
  '/static/manifest.json',
  '/static/images/icon.svg',
  '/static/images/favicon.ico',
  // Editorial theme — CSS (includes @import of fontawesome-all.min.css)
  '/static/editorial/assets/css/main.css',
  '/static/editorial/assets/css/fontawesome-all.min.css',
  // Editorial theme — JS
  '/static/editorial/assets/js/jquery.min.js',
  '/static/editorial/assets/js/browser.min.js',
  '/static/editorial/assets/js/breakpoints.min.js',
  '/static/editorial/assets/js/util.js',
  '/static/editorial/assets/js/main.js',
  '/static/editorial/assets/js/my.js',
  // Callsign player
  '/static/callsigns/js/callsign-player.js',
  // Font Awesome webfonts — all formats for broad browser/OS compatibility
  '/static/editorial/assets/webfonts/fa-solid-900.woff2',
  '/static/editorial/assets/webfonts/fa-solid-900.woff',
  '/static/editorial/assets/webfonts/fa-solid-900.ttf',
  '/static/editorial/assets/webfonts/fa-brands-400.woff2',
  '/static/editorial/assets/webfonts/fa-brands-400.woff',
  '/static/editorial/assets/webfonts/fa-brands-400.ttf',
  '/static/editorial/assets/webfonts/fa-regular-400.woff2',
  '/static/editorial/assets/webfonts/fa-regular-400.woff',
  '/static/editorial/assets/webfonts/fa-regular-400.ttf',
];

const PAGE_SHELLS = [
  '/',
  '/user-guide',
  '/phrases/',
  '/phrases/sending',
  '/phrases/ttr',
  '/phrases/phrase-flow',
  '/callsigns/trainer',
  '/books/',
  '/books/garden',
  '/books/aesops_fables',
  '/books/peter_pan',
  '/books/wisteria',
  '/books/princess_of_mars',
];

// Google Fonts hosts to cache (cross-origin)
const GOOGLE_FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// ── Install: pre-cache everything ─────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    preCache().then(() => self.skipWaiting())
  );
});

async function preCache() {
  const cache = await caches.open(CACHE_VERSION);

  // Cache static assets
  await Promise.allSettled(
    STATIC_ASSETS.map(url =>
      fetch(url).then(r => r.ok ? cache.put(url, r) : null).catch(() => null)
    )
  );

  // Cache HTML page shells
  await Promise.allSettled(
    PAGE_SHELLS.map(url =>
      fetch(url).then(r => r.ok ? cache.put(url, r) : null).catch(() => null)
    )
  );

  // Cache phrase index + all phrase data files
  try {
    const indexResp = await fetch('/phrases/api/index');
    if (indexResp.ok) {
      const indexData = await indexResp.json();
      await cache.put('/phrases/api/index', new Response(JSON.stringify(indexData), {
        headers: { 'Content-Type': 'application/json' }
      }));
      const phraseUrls = [];
      for (const [category, files] of Object.entries(indexData.files_by_category || {})) {
        for (const file of files) {
          phraseUrls.push(
            `/phrases/api/data?category=${encodeURIComponent(category)}&file=${encodeURIComponent(file)}`
          );
        }
      }
      for (let i = 0; i < phraseUrls.length; i += 10) {
        await Promise.allSettled(
          phraseUrls.slice(i, i + 10).map(url =>
            fetch(url).then(r => r.ok ? cache.put(url, r) : null).catch(() => null)
          )
        );
      }
    }
  } catch (e) {
    console.warn('[SW] Could not cache phrase data:', e);
  }

  // Cache books index + all verse data files
  try {
    const booksResp = await fetch('/books/api/index');
    if (booksResp.ok) {
      const booksData = await booksResp.json();
      await cache.put('/books/api/index', new Response(JSON.stringify(booksData), {
        headers: { 'Content-Type': 'application/json' }
      }));
      const bookUrls = [];
      for (const book of booksData.books || []) {
        for (const verse of book.verses || []) {
          bookUrls.push(
            `/books/api/data?book=${encodeURIComponent(book.key)}&verse=${encodeURIComponent(verse.file_name)}`
          );
        }
      }
      for (let i = 0; i < bookUrls.length; i += 10) {
        await Promise.allSettled(
          bookUrls.slice(i, i + 10).map(url =>
            fetch(url).then(r => r.ok ? cache.put(url, r) : null).catch(() => null)
          )
        );
      }
    }
  } catch (e) {
    console.warn('[SW] Could not cache book data:', e);
  }

  // Notify clients that offline caching is complete
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({ type: 'CACHE_COMPLETE' });
  }
}

// ── Activate: remove old caches ───────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Google Fonts: stale-while-revalidate so fonts load offline after first visit
  if (GOOGLE_FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Only handle same-origin requests beyond this point
  if (url.origin !== self.location.origin) return;

  // API data + static assets: cache-first
  if (url.pathname.startsWith('/phrases/api/') ||
      url.pathname.startsWith('/books/api/')   ||
      url.pathname.startsWith('/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML pages: network-first with cache fallback
  event.respondWith(networkFirstWithFallback(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response(OFFLINE_PAGE, {
      status: 503, headers: { 'Content-Type': 'text/html' }
    });
  }
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(OFFLINE_PAGE, {
      status: 503, headers: { 'Content-Type': 'text/html' }
    });
  }
}

const OFFLINE_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Offline — CW Practice</title>
  <style>
    body { font-family: Arial, sans-serif; background: #1a2a3a; color: #fff;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; text-align: center; padding: 20px; box-sizing: border-box; }
    .card { background: rgba(255,255,255,0.1); border-radius: 12px; padding: 40px 30px; max-width: 400px; }
    h1 { font-size: 1.6em; margin-bottom: 12px; color: #f0a500; }
    p  { line-height: 1.6; margin-bottom: 24px; color: #ccc; }
    button { background: #f0a500; color: #1a2a3a; border: none; border-radius: 6px;
             padding: 12px 28px; font-size: 1em; font-weight: bold; cursor: pointer; }
    button:hover { background: #d4911a; }
    .status { margin-top: 20px; font-size: 0.85em; color: #aaa; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You are offline</h1>
    <p>This page hasn't been cached yet. Pages you've visited before are available offline.</p>
    <button onclick="location.reload()">Try Again</button>
    <p class="status" id="status">Waiting for connection&hellip;</p>
  </div>
  <script>
    window.addEventListener('online', function() {
      document.getElementById('status').textContent = 'Connection restored — reloading…';
      setTimeout(function() { location.reload(); }, 500);
    });
  </script>
</body>
</html>`;

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then(response => {
    if (response.ok || response.type === 'opaque') {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  return cached || await networkFetch;
}
