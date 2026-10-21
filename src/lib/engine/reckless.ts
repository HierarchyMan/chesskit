import { EngineName } from "@/types/enums";
import { UciEngine } from "./uciEngine";

import { RECKLESS_BRIDGE_URL, probeRecklessBridge } from "./bridge";
export { RECKLESS_BRIDGE_URL, probeRecklessBridge } from "./bridge";

export class Reckless {
  public static async create(signal?: AbortSignal): Promise<UciEngine> {
    if (!Reckless.isSupported()) {
      throw new Error("Reckless requires WebSocket support");
    }

    if (!(await probeRecklessBridge(signal))) {
      throw new Error(
        "The Reckless bridge is not running. Start it with start-reckless-bridge.bat (or start-chess.bat) and try again."
      );
    }

    return UciEngine.create(
      EngineName.Reckless,
      RECKLESS_BRIDGE_URL,
      undefined,
      signal
    );
  }

  public static isSupported() {
    return typeof WebSocket !== "undefined";
  }
}
