/* sw.js: the offline page for the installed app, and cross-origin isolation (2.2.0, 15 Nov 2026).
 *
 * Opened as an app on a phone with the site out of reach, the browser showed only the app icon. This worker
 * answers one kind of request, a top-level page load of this site (mode "navigate", destination "document",
 * same origin, GET): it waits for the real page and hands it over unchanged; with no network at all, or no
 * answer within WAIT_MS, it shows offline.html instead. offline.html then checks by itself every few seconds and,
 * once the site answers, tells this worker (a message) to give that one page load LONG_WAIT_MS, so a slow but
 * working connection gets the site instead of the card again.
 *
 * It also makes the site cross-origin isolated on a host that cannot send headers, which shared memory
 * between threads needs. Three kinds of same-origin GET answer get "Cross-Origin-Opener-Policy: same-origin"
 * and "Cross-Origin-Embedder-Policy: credentialless" added, the same two headers the local server sends on
 * every answer: top-level pages (HTML only), frames (the play windows, R.O.B.) and worker scripts. Inside an
 * isolated page a frame or a worker script without them is refused, so the three always change together.
 * A page is isolated from the first load this worker controls. The first visit, a forced reload and a
 * browser that does not know "credentialless" are not isolated, and a core then runs on one thread.
 * Nothing here reloads a page.
 *
 * Everything else is left to the browser exactly as without a worker: scripts, game files, covers, clips,
 * video with Range, the media servers, the game server, other sites.
 * Where the browser has static routes (event.addRoutes) those requests never reach this worker at all;
 * elsewhere the fetch handler returns without respondWith, which is the same thing.
 *
 * Stored: offline.html and its one picture, in one cache named CACHE. Nothing else, ever.
 * Change either file: raise CACHE's number, so the new worker fetches them and drops the old cache.
 *
 * Taking the isolation out again, in two steps, so that a tab left open keeps working:
 *   1. set ISOLATE_PAGES to false. New page loads are no longer isolated. Frames and worker scripts keep
 *      their headers: a tab that was isolated when it loaded refuses every play window without them.
 *   2. some weeks later the routes, the fetch filter and the answer can go back to their 2.1.1 form.
 * Removing the whole worker (only after step 1 has been out for some weeks): replace this file with
 *   self.addEventListener('install', function () { self.skipWaiting(); });
 *   self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (n) { return n.indexOf('cw-offline-') === 0; }).map(function (n) { return caches.delete(n); })); }).then(function () { return self.registration.unregister(); })); });
 * and take the register block out of index.html (search "sw.js").
 */
'use strict';
var PREFIX = 'cw-offline-';
var CACHE = PREFIX + 'v4';
var WAIT_MS = 3000;          /* 10 s was too long on a phone */
var LONG_WAIT_MS = 20000;    /* the next page load after offline.html saw the site answer */
var longUntil = 0;
var ISOLATE_PAGES = true;   /* false: new page loads are no longer isolated (step 1 of taking it out) */
var SCOPE = self.registration.scope;
var OFFLINE = new URL('offline.html', SCOPE).href;
var PICTURE = new URL('images/parachute-spirit.webp', SCOPE).href;

self.addEventListener('install', function (event) {
  /* Static routes: every request that is not a page, a frame or a worker script goes straight to the network,
     without starting or waking this worker. A browser without them, or that refuses a rule, uses the fetch
     filter below. */
  if (event.addRoutes) {
    try {
      event.waitUntil(Promise.resolve(event.addRoutes([
        { condition: { not: { or: [{ requestMode: 'navigate' }, { requestDestination: 'worker' }, { requestDestination: 'sharedworker' }] } }, source: 'network' }
      ])).catch(function () {}));
    } catch (e) {}
  }
  event.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll([new Request(OFFLINE, { cache: 'reload' }), new Request(PICTURE, { cache: 'reload' })]);
  }));
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(Promise.all([
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n.indexOf(PREFIX) === 0 && n !== CACHE; })
        .map(function (n) { return caches.delete(n); }));
    }),
    /* Navigation preload: the page request starts at once, while this worker is still starting. */
    self.registration.navigationPreload ? self.registration.navigationPreload.enable().catch(function () {}) : null
  ]));
});

function offlinePage() {
  return caches.open(CACHE).then(function (c) { return c.match(OFFLINE); }).catch(function () { return null; })
    .then(function (r) {
      return r || new Response('<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        + '<title>Offline · You’ve landed in the wrong place · CrystalWorlds.Media</title><body style="font-family:sans-serif;background:#0a0e14;color:#e6ebf2;text-align:center;padding:40px 16px">'
        + '<p>We can’t reach CrystalWorlds.Media right now. Check your connection and try again.</p>'
        + '<button onclick="location.reload()">Try again</button>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    });
}

self.addEventListener('message', function (event) {
  if (!event.data || event.data.cw !== 'offline-retry') return;
  longUntil = Date.now() + 15000;
  if (event.ports && event.ports[0]) event.ports[0].postMessage('ok');
});

function pageLoad(event) {
  var wait = Date.now() < longUntil ? LONG_WAIT_MS : WAIT_MS;
  longUntil = 0;
  var preload = Promise.resolve(event.preloadResponse);
  if (self.navigator && self.navigator.onLine === false) {
    event.waitUntil(preload.catch(function () {}));
    return offlinePage();
  }
  /* One browser settles a failed preload with an answer of type "error" where another rejects: both count as no answer. */
  var net = preload.then(function (r) { return r && r.type !== 'error' ? r : fetch(event.request); });
  return new Promise(function (resolve) {
    var done = false;
    var fallback = function () { if (done) return; done = true; clearTimeout(timer); resolve(offlinePage()); };
    var timer = setTimeout(fallback, wait);
    net.then(function (r) { if (!r || r.type === 'error') return fallback(); if (done) return; done = true; clearTimeout(timer); resolve(r); }, fallback);
  });
}

/* Adds the two isolation headers to one answer. An answer the worker cannot read or rebuild is handed over
   as it is: a redirect or any other status-0 answer, and anything the Response constructor refuses. */
function isolate(res) {
  if (!res || res.status === 0) return res;
  try {
    var h = new Headers(res.headers);
    h.set('Cross-Origin-Opener-Policy', 'same-origin');
    h.set('Cross-Origin-Embedder-Policy', 'credentialless');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  } catch (e) { return res; }
}
/* A frame's network answer. The answer the browser preloaded is used where there is one. Where there is none,
   or it was refused (one browser refuses a frame answer that lacks the headers before this worker can add
   them, when the page around the frame is isolated), the same address is fetched again as plain data. */
function frameLoad(event) {
  var req = event.request;
  var again = function () {
    return fetch(req.url, { headers: req.headers, cache: req.cache === 'only-if-cached' ? 'default' : req.cache,
      redirect: 'manual', referrer: req.referrer, referrerPolicy: req.referrerPolicy });
  };
  return Promise.resolve(event.preloadResponse).then(function (r) { return r && r.type !== 'error' ? r : again(); }, again);
}
/* A top-level page: only HTML is isolated. A download, a picture or a PDF opened in the tab passes untouched. */
function isolatePage(res) {
  if (!ISOLATE_PAGES || !res || !res.headers) return res;
  if (!/^\s*(text\/html|application\/xhtml\+xml)\b/i.test(res.headers.get('Content-Type') || '')) return res;
  return isolate(res);
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var nav = req.mode === 'navigate';
  if (!nav && req.destination !== 'worker' && req.destination !== 'sharedworker') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  if (nav && req.destination === 'document') { event.respondWith(pageLoad(event).then(isolatePage)); return; }
  /* A frame or a worker script: the network answer with the two headers added. The offline card is for pages only. */
  event.respondWith((nav ? frameLoad(event) : fetch(req)).then(isolate));
});
