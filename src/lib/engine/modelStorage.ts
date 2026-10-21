// Engine files kept on this device for offline use. The service worker in
// public/engine-cache-sw.js answers engine requests from this cache first.
export const MODEL_CACHE_NAME = "chesskit-engine-models-v1";
export const MODEL_WORKER_PATH = "/engine-cache-sw.js";

// Stored responses carry their byte count here, so sizes never read the bodies.
const BYTES_HEADER = "x-chesskit-bytes";

export const isModelStorageSupported = (): boolean =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  "caches" in window &&
  "serviceWorker" in navigator;

// Resolves like the Worker constructor does, so cache keys match engine requests.
const fileUrl = (path: string): string => new URL(path, document.baseURI).href;

export const registerModelCacheWorker = (): void => {
  if (!isModelStorageSupported()) return;

  navigator.serviceWorker
    .register(MODEL_WORKER_PATH)
    .catch((reason) => console.error(reason));
};

export const readStoredFiles = async (
  paths: string[]
): Promise<Map<string, number>> => {
  const stored = new Map<string, number>();
  if (!isModelStorageSupported()) return stored;

  const cache = await caches.open(MODEL_CACHE_NAME);
  await Promise.all(
    paths.map(async (path) => {
      const response = await cache.match(fileUrl(path));
      if (response) {
        stored.set(path, Number(response.headers.get(BYTES_HEADER) ?? 0));
      }
    })
  );

  return stored;
};

export const downloadModelFiles = async (
  paths: string[],
  onFileDone: (count: number) => void
): Promise<void> => {
  const cache = await caches.open(MODEL_CACHE_NAME);
  const written: string[] = [];

  try {
    for (const [index, path] of paths.entries()) {
      // "reload" bypasses the HTTP cache and the service worker, so the stored copy comes from the server.
      const response = await fetch(fileUrl(path), { cache: "reload" });
      if (!response.ok) {
        throw new Error(`${path} returned HTTP ${response.status}`);
      }

      const blob = await response.blob();
      await cache.put(
        fileUrl(path),
        new Response(blob, {
          headers: {
            "content-type":
              response.headers.get("content-type") ??
              "application/octet-stream",
            [BYTES_HEADER]: String(blob.size),
          },
        })
      );

      written.push(path);
      onFileDone(index + 1);
    }
  } catch (error) {
    // A half-finished model must not keep its files, or it would count as partly downloaded.
    await removeModelFiles(written).catch(() => undefined);
    throw error;
  }
};

export const removeModelFiles = async (paths: string[]): Promise<void> => {
  const cache = await caches.open(MODEL_CACHE_NAME);
  await Promise.all(paths.map((path) => cache.delete(fileUrl(path))));
};
