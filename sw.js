const CACHE = "kalam-static-v15";
const CORE_FILES = ["./", "./index.html", "./workspace.html", "./cases.html", "./login.html", "./manifest.webmanifest", "./js/letterhead.js", "./assets/qalam-letterhead-emblem.png"];

// Install a new cache without letting an old HTML shell block future updates.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("kalam-static-") && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  // Always try the network first for pages so a published release is visible promptly.
  if (request.mode === "navigate" || /\\.html?$/i.test(new URL(request.url).pathname) || new URL(request.url).pathname.endsWith("/")) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
    );
    return;
  }

  // Static assets can use cache-first, with network fallback.
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
