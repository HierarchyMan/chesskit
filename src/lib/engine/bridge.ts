export const RECKLESS_BRIDGE_URL = "ws://127.0.0.1:8787/reckless";

const BRIDGE_PROBE_TIMEOUT_MS = 3000;

export const probeRecklessBridge = (signal?: AbortSignal): Promise<boolean> =>
  new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    let socket: WebSocket;
    try {
      socket = new WebSocket(RECKLESS_BRIDGE_URL);
    } catch {
      resolve(false);
      return;
    }

    const finish = (reachable: boolean) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      socket.onopen = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      resolve(reachable);
    };

    const abort = () => finish(false);
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => finish(false), BRIDGE_PROBE_TIMEOUT_MS);

    socket.onopen = () => finish(true);
    socket.onerror = () => finish(false);
    socket.onclose = () => finish(false);
  });
