// Serves engine files that the user downloaded for offline use. Anything not
// stored here goes to the network unchanged.
const CACHE_PREFIX = "chesskit-engine-models-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const ENGINES_PATH = "/engines/";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME
          )
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(ENGINES_PATH) ||
    // Downloads ask for a fresh copy with "reload", which must reach the server.
    request.cache === "reload"
  ) {
    return;
  }

  // A cache that cannot be opened or read must never break an engine load.
  event.respondWith(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.match(request.url))
      .catch(() => undefined)
      .then((cached) => cached ?? fetch(request))
  );
});
