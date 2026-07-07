/* "180 Days" service worker — offline support for the installed app.
 *
 * Strategy, chosen to avoid version skew (new HTML paired with stale JS):
 *   - HTML + code (js/css/manifest): network-first, fall back to cache when
 *     offline. Online users always get a consistent fresh set; offline users
 *     get the last-cached consistent set.
 *   - Images: cache-first (they change only with a CACHE_VERSION bump).
 * Bump CACHE_VERSION on any release so activate() clears the old cache.
 */
const CACHE_VERSION = "days180-v2";

// App shell precached on install. Kept small and resilient: a single missing
// file must not abort the whole install (see the allSettled below).
const SHELL = [
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/engine.js",
  "./manifest.webmanifest",
  "./assets/brand/app-180-192.png",
];

const isCode = (url) => /\.(?:js|css|webmanifest)$/.test(url.pathname);
const isImage = (url) => /\.(?:png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname);

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putIfOk(req, res) {
  if (res && res.ok && res.type === "basic") {
    const copy = res.clone();
    caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Navigations + code: network-first, cache only successful responses,
  // fall back to cache (then the shell) when offline.
  if (req.mode === "navigate" || isCode(url)) {
    const key = req.mode === "navigate" ? "./index.html" : req;
    e.respondWith(
      fetch(req)
        .then((res) => { putIfOk(key, res); return res; })
        .catch(async () => (await caches.match(key)) || (await caches.match("./index.html")) || Response.error())
    );
    return;
  }

  // Images / everything else: cache-first, lazily fill the cache on first use.
  e.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => (isImage(url) ? putIfOk(req, res) : res)).catch(() => Response.error())
    )
  );
});
