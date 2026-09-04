// CW WA7PGE — Service Worker
// Bump CACHE_VERSION when static assets change to force a cache refresh.
const CACHE_PREFIX = 'cw-v';
const CACHE_VERSION = CACHE_PREFIX + '6';

// The API is served by gunicorn with 2 workers x 4 threads = 8 concurrent
// requests for the whole site. Keep our own concurrency well under that or we
// starve the user's page navigations and they stare at a blank screen.
const INSTALL_CONCURRENCY = 4;
const WARM_CONCURRENCY = 2;

// Serve a cached page rather than waiting forever on a stalled network.
const NAV_SOFT_TIMEOUT_MS = 2500;   // after this, prefer the cache
const NAV_HARD_TIMEOUT_MS = 8000;   // after this, show the "please wait" page

// How often to tell the page how the background warm is going.
const PROGRESS_EVERY = 10;

const STATIC_ASSETS = [
  '/static/js/jscwlib.js',
  '/static/js/form-state.js',
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

const DATA_INDEXES = ['/phrases/api/index', '/books/api/index'];

// Google Fonts hosts to cache (cross-origin)
const GOOGLE_FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// ── Install: pre-cache only what the app needs to render ──────────────────────
//
// The ~800 phrase/book data files are NOT fetched here. Pulling them during
// install saturates the server and any navigation that happens meanwhile hangs.
// They are warmed in the background after activation instead (see WARM_CACHE).

self.addEventListener('install', (event) => {
  event.waitUntil(
    precacheCritical().then(() => self.skipWaiting())
  );
});

async function precacheCritical() {
  const cache = await caches.open(CACHE_VERSION);
  const urls = [...STATIC_ASSETS, ...PAGE_SHELLS, ...DATA_INDEXES];
  await fetchIntoCache(cache, urls, INSTALL_CONCURRENCY);
}

// ── Activate: take over, but keep the previous cache as a fallback ────────────
//
// The previous cache still holds the bulk data this version hasn't warmed yet.
// `caches.match()` searches every cache, so keeping it means no offline gap
// while the warm runs. It is pruned once the warm completes.

self.addEventListener('activate', (event) => {
  event.waitUntil(
    pruneCaches({ keepPrevious: true }).then(() => self.clients.claim())
  );
});

// ── Background warm, driven by the page ──────────────────────────────────────
//
// Run from a `message` event so `event.waitUntil` keeps the worker alive for
// the duration. Every page load re-triggers it, so an interrupted warm resumes
// where it left off — already-cached URLs are skipped.

let warmInProgress = false;

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'WARM_CACHE') return;
  if (warmInProgress) return;
  warmInProgress = true;
  event.waitUntil(
    warmBulkCache()
      .catch(e => console.warn('[SW] Warm failed:', e))
      .finally(() => { warmInProgress = false; })
  );
});

async function warmBulkCache() {
  const cache = await caches.open(CACHE_VERSION);
  const urls = await collectBulkUrls(cache);

  const missing = [];
  for (const url of urls) {
    if (!(await cache.match(url))) missing.push(url);
  }

  // Nothing to do — a previous run already finished. Stay quiet; announcing
  // "ready for offline use" on every single page load is just noise.
  if (!missing.length) {
    await pruneCaches({ keepPrevious: false });
    return;
  }

  await broadcast({ type: 'CACHE_PROGRESS', done: 0, total: missing.length });

  let done = 0;
  await fetchIntoCache(cache, missing, WARM_CONCURRENCY, async () => {
    done++;
    if (done % PROGRESS_EVERY === 0 || done === missing.length) {
      await broadcast({ type: 'CACHE_PROGRESS', done, total: missing.length });
    }
  });

  // Any fetch that failed left a gap. Keep the previous cache as a fallback and
  // let the next page load retry — but tell the page, so its progress banner
  // isn't left sitting there implying work is still happening.
  const gaps = [];
  for (const url of missing) {
    if (!(await cache.match(url))) gaps.push(url);
  }
  if (gaps.length) {
    await broadcast({ type: 'CACHE_INCOMPLETE', remaining: gaps.length });
    return;
  }

  await broadcast({ type: 'CACHE_COMPLETE' });
  await pruneCaches({ keepPrevious: false });
}

// Build the list of phrase + book data URLs from the two index endpoints.
// Reads them from the cache (precached at install) to avoid extra requests.
async function collectBulkUrls(cache) {
  const urls = [];

  const phrases = await readJson(cache, '/phrases/api/index');
  for (const [category, files] of Object.entries(phrases?.files_by_category || {})) {
    for (const file of files) {
      urls.push(`/phrases/api/data?category=${encodeURIComponent(category)}&file=${encodeURIComponent(file)}`);
    }
  }

  const books = await readJson(cache, '/books/api/index');
  for (const book of books?.books || []) {
    for (const verse of book.verses || []) {
      urls.push(`/books/api/data?book=${encodeURIComponent(book.key)}&verse=${encodeURIComponent(verse.file_name)}`);
    }
  }

  return urls;
}

async function readJson(cache, url) {
  try {
    let resp = await cache.match(url);
    if (!resp) {
      resp = await fetch(url);
      if (!resp.ok) return null;
      await cache.put(url, resp.clone());
    }
    return await resp.json();
  } catch (e) {
    console.warn('[SW] Could not read', url, e);
    return null;
  }
}

// Fetch `urls` into `cache` with a bounded number of in-flight requests.
async function fetchIntoCache(cache, urls, concurrency, onEach) {
  const queue = urls.slice();

  async function worker() {
    while (queue.length) {
      const url = queue.shift();
      try {
        const resp = await fetch(url);
        if (resp.ok) await cache.put(url, resp);
      } catch {
        // Left uncached on purpose — retried on the next page load.
      }
      if (onEach) await onEach(url);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, worker)
  );
}

async function pruneCaches({ keepPrevious }) {
  const keys = await caches.keys();
  const others = keys.filter(k => k !== CACHE_VERSION && k.startsWith(CACHE_PREFIX));

  let keep = [];
  if (keepPrevious && others.length) {
    others.sort((a, b) => cacheVersionNumber(a) - cacheVersionNumber(b));
    keep = [others[others.length - 1]];
  }

  await Promise.all(
    others.filter(k => !keep.includes(k)).map(k => caches.delete(k))
  );
}

function cacheVersionNumber(key) {
  return parseInt(key.slice(CACHE_PREFIX.length), 10) || 0;
}

async function broadcast(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) client.postMessage(msg);
}

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

  // HTML pages: network-first, but never wait forever — see below.
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
    return htmlResponse(OFFLINE_PAGE);
  }
}

// Network-first with a soft timeout. Waiting on an unbounded `fetch()` is what
// produced the long blank screen: a stalled or congested connection never
// rejects, so the navigation hung. Now the cached shell wins after
// NAV_SOFT_TIMEOUT_MS, and if nothing is cached we show a wait page rather
// than nothing at all.
async function networkFirstWithFallback(request) {
  const network = fetch(request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  const fresh = await Promise.race([network, timeoutAfter(NAV_SOFT_TIMEOUT_MS)]);
  if (fresh) return fresh;

  const cached = await caches.match(request);
  if (cached) return cached;

  // Nothing cached for this page — give the network the rest of its budget.
  const late = await Promise.race([
    network,
    timeoutAfter(NAV_HARD_TIMEOUT_MS - NAV_SOFT_TIMEOUT_MS),
  ]);
  if (late) return late;

  // Online but nothing came back: the server is most likely still busy
  // serving an update. Say so, and retry on the user's behalf.
  return htmlResponse(navigator.onLine ? UPDATING_PAGE : OFFLINE_PAGE);
}

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

function timeoutAfter(ms) {
  return new Promise(resolve => setTimeout(() => resolve(null), ms));
}

function htmlResponse(body) {
  return new Response(body, {
    status: 503, headers: { 'Content-Type': 'text/html' }
  });
}

// ── Fallback pages ────────────────────────────────────────────────────────────

const PAGE_STYLE = `
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
    .spinner { width: 38px; height: 38px; margin: 0 auto 22px; border-radius: 50%;
               border: 4px solid rgba(255,255,255,0.2); border-top-color: #f0a500;
               animation: spin 0.9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
`;

const UPDATING_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Updating — CW Practice</title>
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h1>Updating&hellip;</h1>
    <p>The app is finishing an update. This page will load as soon as it's ready — no need to close the app.</p>
    <button onclick="location.reload()">Reload Now</button>
    <p class="status" id="status">Retrying in 5s&hellip;</p>
  </div>
  <script>
    var left = 5;
    var status = document.getElementById('status');
    setInterval(function() {
      left--;
      if (left <= 0) { status.textContent = 'Retrying\\u2026'; location.reload(); return; }
      status.textContent = 'Retrying in ' + left + 's\\u2026';
    }, 1000);
  </script>
</body>
</html>`;

const OFFLINE_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Offline — CW Practice</title>
  <style>${PAGE_STYLE}</style>
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
