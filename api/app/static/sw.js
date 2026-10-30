// CW WA7PGE — Service Worker
// Bump CACHE_VERSION when static assets change to force a cache refresh.
const CACHE_PREFIX = 'cw-v';
const CACHE_VERSION = CACHE_PREFIX + '11';

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
  '/static/js/my-phrases.js',
  '/static/js/wake-lock.js',
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
  '/phrases/my-phrases',
  '/phrases/my-phrases/edit',
  '/callsigns/trainer',
  '/books/',
  '/books/garden',
  '/books/aesops_fables',
  '/books/peter_pan',
  '/books/oz',
];

const DATA_INDEXES = ['/phrases/api/index', '/books/api/index'];

// Google Fonts hosts to cache (cross-origin)
const GOOGLE_FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// ── Install: pre-cache only what the app needs to render ──────────────────────
//
// The ~800 phrase/book data files are NOT fetched here. Pulling them during
// install saturates the server and any navigation that happens meanwhile hangs.
// They are warmed in the background after activation instead (see WARM_CACHE).
//
// If the server couldn't be reached for any of these (network error or 5xx —
// typically a deploy in progress), install fails. The browser keeps the old
// worker and its intact cache, and retries the update on a later visit. Without
// this, a worker installed mid-deploy activates with an empty cache and the
// user has no offline fallback at all. A 4xx is a genuinely missing page, not
// a server outage, so it doesn't block install.

self.addEventListener('install', (event) => {
  event.waitUntil(
    precacheCritical().then(() => self.skipWaiting())
  );
});

async function precacheCritical() {
  const cache = await caches.open(CACHE_VERSION);
  const urls = [...STATIC_ASSETS, ...PAGE_SHELLS, ...DATA_INDEXES];
  const failed = await fetchIntoCache(cache, urls, INSTALL_CONCURRENCY);
  if (failed.length) {
    throw new Error(`[SW] Install aborted, ${failed.length} critical URLs unreachable: ${failed.join(', ')}`);
  }
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
// Fetches them fresh so newly added files get warmed; falls back to the cache.
async function collectBulkUrls(cache) {
  await fetchIntoCache(cache, DATA_INDEXES, DATA_INDEXES.length);

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
// Returns the URLs the server couldn't deliver (network error or 5xx).
async function fetchIntoCache(cache, urls, concurrency, onEach) {
  const queue = urls.slice();
  const failed = [];

  async function worker() {
    while (queue.length) {
      const url = queue.shift();
      try {
        const resp = await fetch(url);
        if (resp.ok) await cache.put(url, resp);
        else if (resp.status >= 500) failed.push(url);
      } catch {
        // Left uncached on purpose — retried on the next page load.
        failed.push(url);
      }
      if (onEach) await onEach(url);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, worker)
  );
  return failed;
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

  // Indexes: network-first, so newly added phrase/book files show up without a
  // CACHE_VERSION bump. Falls back to the cache when offline or slow.
  if (DATA_INDEXES.includes(url.pathname)) {
    event.respondWith(networkFirstData(request));
    return;
  }

  // Phrase/book data: serve the cached copy instantly (works offline), refresh
  // it in the background so edited files are picked up on the next load.
  if (url.pathname.startsWith('/phrases/api/') ||
      url.pathname.startsWith('/books/api/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Static assets: cache-first (bump CACHE_VERSION to refresh)
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML pages: network-first, but never wait forever — see below.
  event.respondWith(networkFirstWithFallback(request));
});

async function cacheFirst(request) {
  // Check this version's cache first. `caches.match()` searches every cache in
  // creation order, so while activate() is still holding the previous version
  // as a fallback, the OLD cache wins — and a CACHE_VERSION bump silently fails
  // to deliver an updated JS or CSS file. Falling back to caches.match() only
  // when the current cache has no copy keeps the no-offline-gap behaviour that
  // retention is there for.
  const cache = await caches.open(CACHE_VERSION);
  const cached = (await cache.match(request)) || (await caches.match(request));
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
  // Remember *why* the network gave us nothing: a rejected fetch (DNS, TLS,
  // connection refused) is a different problem from a slow server, and the
  // user deserves to be told which.
  let networkError = null;
  const network = fetch(request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  }).catch(err => { networkError = err; return null; });

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

  if (!navigator.onLine) return htmlResponse(OFFLINE_PAGE);

  // The connection itself failed. Not an update — the server is unreachable
  // from this network (or down). Say so plainly.
  if (networkError) {
    console.warn('[SW] Navigation failed:', networkError);
    return htmlResponse(UNREACHABLE_PAGE);
  }

  // Connected but nothing came back in time: the server is most likely still
  // busy serving an update. Say so, and retry on the user's behalf.
  return htmlResponse(UPDATING_PAGE);
}

// Network-first for small JSON data, with a soft timeout so a stalled
// connection falls back to the cache instead of hanging.
async function networkFirstData(request) {
  const network = fetch(request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      await cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  const fresh = await Promise.race([network, timeoutAfter(NAV_SOFT_TIMEOUT_MS)]);
  if (fresh && fresh.ok) return fresh;

  const cache = await caches.open(CACHE_VERSION);
  const cached = (await cache.match(request)) || (await caches.match(request));
  if (cached) return cached;

  const late = await network;
  return late || htmlResponse(OFFLINE_PAGE);
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = (await cache.match(request)) || (await caches.match(request));
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
    button.secondary { background: transparent; color: #ccc; border: 1px solid #667;
                       margin-top: 14px; font-weight: normal; font-size: 0.85em; padding: 8px 18px; }
    button.secondary:hover { background: rgba(255,255,255,0.1); }
    .status { margin-top: 20px; font-size: 0.85em; color: #aaa; }
    .spinner { width: 38px; height: 38px; margin: 0 auto 22px; border-radius: 50%;
               border: 4px solid rgba(255,255,255,0.2); border-top-color: #f0a500;
               animation: spin 0.9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
`;

// "Reset app": unregister this worker and drop every cache, then reload
// straight from the network. The escape hatch for a user stuck behind a bad
// cache — without it they'd have to dig through browser settings.
const RESET_BUTTON = `
    <button class="secondary" onclick="resetApp()">Reset app</button>`;

const RESET_SCRIPT = `
    function resetApp() {
      var statusEl = document.getElementById('status');
      if (statusEl) statusEl.textContent = 'Resetting\\u2026';
      var unregister = navigator.serviceWorker
        ? navigator.serviceWorker.getRegistrations().then(function(regs) {
            return Promise.all(regs.map(function(r) { return r.unregister(); }));
          })
        : Promise.resolve();
      var clear = window.caches
        ? caches.keys().then(function(keys) {
            return Promise.all(keys.map(function(k) { return caches.delete(k); }));
          })
        : Promise.resolve();
      Promise.all([unregister, clear]).catch(function() {}).then(function() {
        location.reload();
      });
    }`;

// Count down, then reload. Named `statusEl`, not `status`: a top-level
// `var status` is the legacy `window.status` string, so writes to its
// textContent silently vanish and the countdown sticks at its first value.
function retryScript(seconds) {
  return `
    var left = ${seconds};
    var statusEl = document.getElementById('status');
    setInterval(function() {
      left--;
      if (left <= 0) { statusEl.textContent = 'Retrying\\u2026'; location.reload(); return; }
      statusEl.textContent = 'Retrying in ' + left + 's\\u2026';
    }, 1000);`;
}

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
    <p class="status" id="status">Retrying in 5s&hellip;</p>${RESET_BUTTON}
  </div>
  <script>${retryScript(5)}${RESET_SCRIPT}
  </script>
</body>
</html>`;

const UNREACHABLE_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Can't reach server — CW Practice</title>
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <div class="card">
    <h1>Can't reach the server</h1>
    <p>Your device is online, but the connection to the CW Practice server failed. The server may be down, or this network may be blocking it — try switching between Wi-Fi and cellular.</p>
    <button onclick="location.reload()">Try Again</button>
    <p class="status" id="status">Retrying in 15s&hellip;</p>${RESET_BUTTON}
  </div>
  <script>${retryScript(15)}${RESET_SCRIPT}
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
    <p class="status" id="status">Waiting for connection&hellip;</p>${RESET_BUTTON}
  </div>
  <script>${RESET_SCRIPT}
    window.addEventListener('online', function() {
      document.getElementById('status').textContent = 'Connection restored — reloading…';
      setTimeout(function() { location.reload(); }, 500);
    });
  </script>
</body>
</html>`;
