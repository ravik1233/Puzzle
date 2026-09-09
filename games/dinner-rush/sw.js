const CACHE = "dinner-rush-v1";
const APP_SHELL = [
  "./index.html",
  "./style.css",
  "./engine.js",
  "./levels-data.js",
  "./script.js",
  "./manifest.json",
  "./favicon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const isSameOrigin = new URL(req.url).origin === self.location.origin;

  if (isSameOrigin) {
    // App shell: cache-first, refresh cache in the background.
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req).then((res) => {
          caches.open(CACHE).then((cache) => cache.put(req, res.clone()));
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  } else {
    // Fonts etc: network-first so they stay fresh, fall back to cache offline.
    event.respondWith(
      fetch(req).then((res) => {
        caches.open(CACHE).then((cache) => cache.put(req, res.clone()));
        return res;
      }).catch(() => caches.match(req))
    );
  }
});
