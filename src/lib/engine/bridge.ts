import { NativeEngineInfo } from "./models";

// The local bridge (engine-bridge/server.mjs) runs native engines listed in engines/engines.json.
export const BRIDGE_ORIGIN = "127.0.0.1:8787";
export const BRIDGE_LIST_URL = `http://${BRIDGE_ORIGIN}/engines`;

export const bridgeEngineUrl = (id: string): string =>
  `ws://${BRIDGE_ORIGIN}/engine/${encodeURIComponent(id)}`;

const BRIDGE_PROBE_TIMEOUT_MS = 3000;

export interface BridgeListing {
  engines: (NativeEngineInfo & { available: boolean; error?: string })[];
}

/** The bridge's engine list, or undefined when the bridge is not running. */
export const fetchBridgeListing = async (
  signal?: AbortSignal
): Promise<BridgeListing | undefined> => {
  if (signal?.aborted || typeof fetch === "undefined") return undefined;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, BRIDGE_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(BRIDGE_LIST_URL, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return undefined;
    const listing = (await response.json()) as BridgeListing;
    return Array.isArray(listing?.engines) ? listing : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
};

/** Whether the bridge runs and has this engine's program in place. */
export const probeBridgeEngine = async (
  id: string,
  signal?: AbortSignal
): Promise<{ running: boolean; available: boolean; error?: string }> => {
  const listing = await fetchBridgeListing(signal);
  if (!listing) return { running: false, available: false };
  const engine = listing.engines.find((entry) => entry.id === id);
  return {
    running: true,
    available: !!engine?.available,
    error: engine?.error,
  };
};
