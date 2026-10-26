// Serves the engines the user downloaded into this browser. The app serves only
// its bundled engine, so a request for anything not stored here goes to the
// network unchanged (and finds nothing there unless it is the bundled engine).
const CACHE_PREFIX = "chesskit-engine-models-";
const CACHE_NAME = `${CACHE_PREFIX}v2`;
// The page carries matching v1 downloads over to v2 and then deletes v1 itself.
const LEGACY_CACHE_NAME = `${CACHE_PREFIX}v1`;
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
            (name) =>
              name.startsWith(CACHE_PREFIX) &&
              name !== CACHE_NAME &&
              name !== LEGACY_CACHE_NAME
          )
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

// A page opened with a hard reload has no service worker until it asks for one.
self.addEventListener("message", (event) => {
  if (event.data?.type === "claim") event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(ENGINES_PATH)
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
