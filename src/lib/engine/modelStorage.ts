import { EngineId } from "@/types/enums";
import {
  EngineModel,
  getDownloadFiles,
  getEngineFile,
  isBundledFile,
} from "./models";

// Engines the user downloaded, kept in this browser. The app serves only the
// bundled engine; every other engine is fetched from its pinned public URL
// (engineFiles.json), checked against its SHA-256 and stored here under its
// /engines/ path. The service worker in public/engine-cache-sw.js answers the
// engine's own requests for those paths from this cache.
export const MODEL_CACHE_NAME = "chesskit-engine-models-v2";
// Before v2, downloads were copies of the app's own files; matching ones are carried over once.
const LEGACY_CACHE_NAME = "chesskit-engine-models-v1";
export const MODEL_WORKER_PATH = "/engine-cache-sw.js";

// Stored responses carry their size and hash here, so checks never read the bodies.
const BYTES_HEADER = "x-chesskit-bytes";
const SHA256_HEADER = "x-chesskit-sha256";

const WORKER_CONTROL_TIMEOUT_MS = 5000;

export interface StoredFile {
  bytes: number;
  sha256: string;
}

export const isModelStorageSupported = (): boolean =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  "caches" in window &&
  "serviceWorker" in navigator &&
  !!window.crypto?.subtle;

// Resolves like the Worker constructor does, so cache keys match engine requests.
const fileUrl = (path: string): string => new URL(path, document.baseURI).href;

// The pinned hosts send text/plain for scripts; a Worker and WebAssembly need the real types.
const contentTypeFor = (path: string): string =>
  path.endsWith(".js")
    ? "text/javascript"
    : path.endsWith(".wasm")
      ? "application/wasm"
      : "application/octet-stream";

const sha256Hex = async (data: BufferSource): Promise<string> =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");

const storedResponse = (path: string, blob: Blob, sha256: string) =>
  new Response(blob, {
    headers: {
      "content-type": contentTypeFor(path),
      [BYTES_HEADER]: String(blob.size),
      [SHA256_HEADER]: sha256,
    },
  });

/** Whether this stored copy is the exact file the registry lists. */
export const isFileCurrent = (
  path: string,
  stored: ReadonlyMap<string, StoredFile>
): boolean => stored.get(path)?.sha256 === getEngineFile(path).sha256;

export type DownloadState = "bundled" | "downloaded" | "outdated" | "missing";

/** Whether a browser engine can start: bundled, or every downloaded file current. */
export const downloadStateOf = (
  model: EngineModel,
  stored: ReadonlyMap<string, StoredFile>
): DownloadState => {
  if (model.bundled) return "bundled";
  const files = getDownloadFiles(model);
  if (files.every((file) => isFileCurrent(file, stored))) return "downloaded";
  return files.some((file) => stored.has(file)) ? "outdated" : "missing";
};

export const readStoredFiles = async (
  paths: string[]
): Promise<Map<string, StoredFile>> => {
  const stored = new Map<string, StoredFile>();
  if (!isModelStorageSupported()) return stored;

  const cache = await caches.open(MODEL_CACHE_NAME);
  await Promise.all(
    paths.map(async (path) => {
      const response = await cache.match(fileUrl(path));
      if (response) {
        stored.set(path, {
          bytes: Number(response.headers.get(BYTES_HEADER) ?? 0),
          sha256: response.headers.get(SHA256_HEADER) ?? "",
        });
      }
    })
  );

  return stored;
};

const fetchVerified = async (
  path: string,
  onBytes: (count: number) => void
): Promise<Blob> => {
  const file = getEngineFile(path);
  const response = await fetch(file.url, { mode: "cors" });
  if (!response.ok || !response.body) {
    throw new Error(
      `${new URL(file.url).host} returned HTTP ${response.status}`
    );
  }

  const chunks: Uint8Array[] = [];
  const reader = response.body.getReader();
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    chunks.push(next.value);
    onBytes(next.value.byteLength);
  }

  const blob = new Blob(chunks as BlobPart[]);
  if (blob.size !== file.bytes) {
    throw new Error(`${path}: got ${blob.size} bytes, expected ${file.bytes}`);
  }
  if ((await sha256Hex(await blob.arrayBuffer())) !== file.sha256) {
    throw new Error(`${path} does not match its SHA-256, so it was not kept`);
  }
  return blob;
};

export const downloadModelFiles = async (
  paths: string[],
  onProgress: (receivedBytes: number) => void
): Promise<void> => {
  const cache = await caches.open(MODEL_CACHE_NAME);
  const written: string[] = [];
  let received = 0;

  try {
    for (const path of paths) {
      const blob = await fetchVerified(path, (count) => {
        received += count;
        onProgress(received);
      });
      await cache.put(
        fileUrl(path),
        storedResponse(path, blob, getEngineFile(path).sha256)
      );
      written.push(path);
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

// Copies from the v1 cache that are byte-for-byte the listed files move to v2, so
// nobody downloads them again; anything else is dropped with the old cache.
const migrateLegacyCache = async (): Promise<void> => {
  if (!(await caches.has(LEGACY_CACHE_NAME))) return;
  const legacy = await caches.open(LEGACY_CACHE_NAME);
  const current = await caches.open(MODEL_CACHE_NAME);

  for (const request of await legacy.keys()) {
    const path = new URL(request.url).pathname.replace(/^\//, "");
    if (isBundledFile(path)) continue;
    let file;
    try {
      file = getEngineFile(path);
    } catch {
      continue;
    }
    const response = await legacy.match(request);
    if (!response) continue;
    const blob = await response.blob();
    if (
      blob.size === file.bytes &&
      (await sha256Hex(await blob.arrayBuffer())) === file.sha256
    ) {
      await current.put(fileUrl(path), storedResponse(path, blob, file.sha256));
    }
  }
  await caches.delete(LEGACY_CACHE_NAME);
};

// Engines wait for this, so a carried-over download is never reported missing at startup.
let storageReady: Promise<void> = Promise.resolve();

/** Registers the engine cache worker and carries old downloads over. Resolves when done. */
export const registerModelCacheWorker = (): Promise<void> => {
  if (!isModelStorageSupported()) return storageReady;

  storageReady = (async () => {
    try {
      await navigator.serviceWorker.register(MODEL_WORKER_PATH);
      await migrateLegacyCache();
    } catch (reason) {
      console.error(reason);
    }
  })();
  return storageReady;
};

/**
 * Downloaded engines reach their worker only through the service worker. A
 * page opened with a hard reload has none until the worker claims it.
 */
const ensureCacheWorkerControl = async (): Promise<void> => {
  const container = navigator.serviceWorker;
  if (container.controller) return;

  const controlled = new Promise<void>((resolve) =>
    container.addEventListener("controllerchange", () => resolve(), {
      once: true,
    })
  );
  const timeout = new Promise<void>((resolve) =>
    setTimeout(resolve, WORKER_CONTROL_TIMEOUT_MS)
  );
  const registration = await Promise.race([container.ready, timeout]);
  registration?.active?.postMessage({ type: "claim" });
  await Promise.race([controlled, timeout]);

  if (!container.controller) {
    throw new Error(
      "Downloaded engines load through this browser's engine store, which this page is not using (a hard reload turns it off). Reload the page normally and try again."
    );
  }
};

export type MissingReason =
  | Exclude<DownloadState, "bundled" | "downloaded">
  | "unsupported";

/** A browser engine that the user has not downloaded (or whose copy is out of date). */
export class EngineNotDownloadedError extends Error {
  constructor(
    readonly engine: EngineId,
    readonly reason: MissingReason,
    label: string,
    sizeMb: number
  ) {
    super(
      reason === "unsupported"
        ? `${label} has to be downloaded, and this browser cannot store downloads here (it needs HTTPS or localhost). Pick an engine that comes with the app.`
        : reason === "outdated"
          ? `The downloaded copy of ${label} is out of date. Download it again (${sizeMb} MB) to use it.`
          : `${label} is not downloaded. Download it (${sizeMb} MB) to use it.`
    );
    this.name = "EngineNotDownloadedError";
  }
}

/** Throws unless a browser engine is bundled or downloaded and current, and its files can be served. */
export const requireDownloadedEngine = async (
  model: EngineModel
): Promise<void> => {
  if (model.bundled) return;
  const fail = (reason: MissingReason) =>
    new EngineNotDownloadedError(
      model.name,
      reason,
      model.label.small,
      model.sizeMb
    );

  if (!isModelStorageSupported()) throw fail("unsupported");
  await storageReady;
  const state = downloadStateOf(
    model,
    await readStoredFiles(getDownloadFiles(model))
  );
  if (state === "missing" || state === "outdated") throw fail(state);
  await ensureCacheWorkerControl();
};
