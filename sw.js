/* sw.js: the offline page for the installed app (2.1.0, 8 Nov 2026).
 *
 * Opened as an app on a phone with the site out of reach, the browser showed only the app icon. This worker
 * answers one kind of request, a top-level page load of this site (mode "navigate", destination "document",
 * same origin, GET): it waits for the real page and hands it over unchanged; with no network at all, or no
 * answer within WAIT_MS, it shows offline.html instead. offline.html then checks by itself every few seconds and,
 * once the site answers, tells this worker (a message) to give that one page load LONG_WAIT_MS, so a slow but
 * working connection gets the site instead of the card again.
 *
 * Everything else is left to the browser exactly as without a worker: frames (the play windows, R.O.B.),
 * scripts, game files, covers, clips, video with Range, the media servers, the game server, other sites.
 * Where the browser has static routes (event.addRoutes) those requests never reach this worker at all;
 * elsewhere the fetch handler returns without respondWith, which is the same thing.
 *
 * Stored: offline.html and its one picture, in one cache named CACHE. Nothing else, ever.
 * Change either file: raise CACHE's number, so the new worker fetches them and drops the old cache.
 *
 * Removing it later: replace this file with
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
var SCOPE = self.registration.scope;
var OFFLINE = new URL('offline.html', SCOPE).href;
var PICTURE = new URL('images/parachute-spirit.webp', SCOPE).href;

self.addEventListener('install', function (event) {
  /* Static routes: every request that is not a top-level page goes straight to the network, without
     starting or waking this worker. A browser without them, or that refuses a rule, uses the fetch filter below. */
  if (event.addRoutes) {
    try {
      event.waitUntil(Promise.resolve(event.addRoutes([
        { condition: { not: { requestMode: 'navigate' } }, source: 'network' },
        { condition: { not: { requestDestination: 'document' } }, source: 'network' }
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
  var net = preload.then(function (r) { return r || fetch(event.request); });
  return new Promise(function (resolve) {
    var done = false;
    var fallback = function () { if (done) return; done = true; clearTimeout(timer); resolve(offlinePage()); };
    var timer = setTimeout(fallback, wait);
    net.then(function (r) { if (done) return; done = true; clearTimeout(timer); resolve(r); }, fallback);
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.mode !== 'navigate' || req.destination !== 'document' || req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(pageLoad(event));
});
