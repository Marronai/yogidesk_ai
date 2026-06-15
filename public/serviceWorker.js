const CACHE_NAME = "yogidesk-v1-cache";
const assetsToCache = ["/", "/index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(assetsToCache)));
});

self.addEventListener("fetch", (e) => {
  if (e.request.url.includes("/api/")) return;
  if (e.request.method !== "GET") return;

  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
