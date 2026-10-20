import { EngineName } from "@/types/enums";
import { UciEngine } from "./uciEngine";

export const RECKLESS_BRIDGE_URL = "ws://127.0.0.1:8787/reckless";

const BRIDGE_PROBE_TIMEOUT_MS = 3000;

export class Reckless {
  public static async create(): Promise<UciEngine> {
    if (!Reckless.isSupported()) {
      throw new Error("Reckless requires WebSocket support");
    }

    if (!(await probeRecklessBridge())) {
      throw new Error(
        "The Reckless bridge is not running. Start it with start-reckless-bridge.bat (or start-chess.bat) and try again."
      );
    }

    return UciEngine.create(EngineName.Reckless, RECKLESS_BRIDGE_URL);
  }

  public static isSupported() {
    return typeof WebSocket !== "undefined";
  }
}

export const probeRecklessBridge = (): Promise<boolean> =>
  new Promise((resolve) => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(RECKLESS_BRIDGE_URL);
    } catch {
      resolve(false);
      return;
    }

    const finish = (reachable: boolean) => {
      clearTimeout(timer);
      socket.onopen = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      resolve(reachable);
    };

    const timer = setTimeout(() => finish(false), BRIDGE_PROBE_TIMEOUT_MS);

    socket.onopen = () => finish(true);
    socket.onerror = () => finish(false);
    socket.onclose = () => finish(false);
  });
