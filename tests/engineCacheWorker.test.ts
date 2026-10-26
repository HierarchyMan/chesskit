import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import vm from "node:vm";

const SOURCE = readFileSync(
  new URL("../public/engine-cache-sw.js", import.meta.url),
  "utf8"
);
const ORIGIN = "http://localhost:3000";
const CURRENT_CACHE = "chesskit-engine-models-v2";
const LEGACY_CACHE = "chesskit-engine-models-v1";
const ENGINE_URL = `${ORIGIN}/engines/stockfish-18/stockfish-18-lite-single.wasm`;

interface FakeRequest {
  url: string;
  method: string;
  cache: string;
}

type Listener = (event: Record<string, unknown>) => void;

const createWorker = (
  storedUrls: string[] = [],
  cacheNames: string[] = [],
  { cacheUnavailable = false }: { cacheUnavailable?: boolean } = {}
) => {
  const listeners = new Map<string, Listener>();
  const storage = new Map<string, Map<string, object>>();
  const networkRequests: string[] = [];
  const cachedResponse = { source: "cache" };
  const networkResponse = { source: "network" };
  let skipWaitingCalled = false;
  let claims = 0;

  for (const name of [CURRENT_CACHE, ...cacheNames]) {
    storage.set(name, new Map());
  }
  for (const url of storedUrls) {
    storage.get(CURRENT_CACHE)?.set(url, cachedResponse);
  }

  const cachesApi = {
    open: async (name: string) => {
      if (cacheUnavailable) throw new Error("storage quota exceeded");
      if (!storage.has(name)) storage.set(name, new Map());
      const entries = storage.get(name)!;
      return {
        match: async (url: string) => entries.get(url),
      };
    },
    keys: async () => [...storage.keys()],
    delete: async (name: string) => storage.delete(name),
  };

  const self = {
    location: new URL(`${ORIGIN}/`),
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, listener);
    },
    skipWaiting: () => {
      skipWaitingCalled = true;
    },
    clients: {
      claim: async () => {
        claims += 1;
      },
    },
  };

  vm.runInNewContext(
    SOURCE,
    {
      self,
      caches: cachesApi,
      fetch: async (request: FakeRequest) => {
        networkRequests.push(request.url);
        return networkResponse;
      },
      URL,
    },
    { filename: "engine-cache-sw.js" }
  );

  const respond = (request: FakeRequest): Promise<unknown> | undefined => {
    let pending: Promise<unknown> | undefined;
    listeners.get("fetch")?.({
      request,
      respondWith: (value: Promise<unknown>) => {
        pending = value;
      },
    });
    return pending;
  };

  return {
    respond,
    networkRequests,
    cachedResponse,
    networkResponse,
    storage,
    skipWaitingCalled: () => skipWaitingCalled,
    claims: () => claims,
    message: async (data: unknown) => {
      let pending: Promise<unknown> | undefined;
      listeners.get("message")?.({
        data,
        waitUntil: (value: Promise<unknown>) => {
          pending = value;
        },
      });
      await pending;
    },
    install: () => listeners.get("install")?.({}),
    activate: async () => {
      let pending: Promise<unknown> | undefined;
      listeners.get("activate")?.({
        waitUntil: (value: Promise<unknown>) => {
          pending = value;
        },
      });
      await pending;
    },
  };
};

const get = (url: string): FakeRequest => ({
  url,
  method: "GET",
  cache: "default",
});

describe("engine cache service worker", () => {
  it("answers a stored engine file from the cache without the network", async () => {
    const worker = createWorker([ENGINE_URL]);

    assert.equal(await worker.respond(get(ENGINE_URL)), worker.cachedResponse);
    assert.deepEqual(worker.networkRequests, []);
  });

  it("falls back to the network for engine files that are not stored (only the bundled engine is there)", async () => {
    const worker = createWorker();

    assert.equal(await worker.respond(get(ENGINE_URL)), worker.networkResponse);
    assert.deepEqual(worker.networkRequests, [ENGINE_URL]);
  });

  it("falls back to the network when the cache cannot be opened", async () => {
    const worker = createWorker([ENGINE_URL], [], { cacheUnavailable: true });

    assert.equal(await worker.respond(get(ENGINE_URL)), worker.networkResponse);
    assert.deepEqual(worker.networkRequests, [ENGINE_URL]);
  });

  it("leaves pages and other site files to the browser", () => {
    const worker = createWorker([ENGINE_URL]);

    assert.equal(worker.respond(get(`${ORIGIN}/analysis`)), undefined);
    assert.equal(worker.respond(get(`${ORIGIN}/puzzles.json`)), undefined);
  });

  it("leaves other origins alone, even with an engines path", () => {
    const worker = createWorker([ENGINE_URL]);

    assert.equal(
      worker.respond(get("https://example.com/engines/stockfish-11.js")),
      undefined
    );
  });

  it("leaves non-GET requests alone", () => {
    const worker = createWorker([ENGINE_URL]);

    assert.equal(
      worker.respond({ url: ENGINE_URL, method: "POST", cache: "default" }),
      undefined
    );
  });

  it("answers a downloaded engine from the cache even on a reload", async () => {
    const worker = createWorker([ENGINE_URL]);

    assert.equal(
      await worker.respond({ url: ENGINE_URL, method: "GET", cache: "reload" }),
      worker.cachedResponse
    );
    assert.deepEqual(worker.networkRequests, []);
  });

  it("claims the page when asked, for a page opened with a hard reload", async () => {
    const worker = createWorker();

    await worker.message({ type: "claim" });
    await worker.message({ type: "other" });
    assert.equal(worker.claims(), 1);
  });

  it("skips the waiting period on install", () => {
    const worker = createWorker();

    worker.install();
    assert.equal(worker.skipWaitingCalled(), true);
  });

  it("deletes old model caches on activate and keeps the current one, the v1 cache the page migrates, and unrelated caches", async () => {
    const worker = createWorker(
      [],
      ["chesskit-engine-models-v0", LEGACY_CACHE, "unrelated-cache"]
    );

    await worker.activate();

    assert.deepEqual([...worker.storage.keys()].sort(), [
      LEGACY_CACHE,
      CURRENT_CACHE,
      "unrelated-cache",
    ]);
  });
});
