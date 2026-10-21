import { EngineName } from "@/types/enums";
import { UciEngine } from "./uciEngine";
import { isWasmSupported } from "./shared";
import { ENGINE_MODELS } from "./models";

export class Stockfish17_1 {
  public static async create(
    lite?: boolean,
    signal?: AbortSignal
  ): Promise<UciEngine> {
    if (!Stockfish17_1.isSupported()) {
      throw new Error("Stockfish 17_1 is not supported");
    }

    const engineName = lite
      ? EngineName.Stockfish17_1Lite
      : EngineName.Stockfish17_1;

    return UciEngine.create(
      engineName,
      ENGINE_MODELS[engineName].script,
      undefined,
      signal
    );
  }

  public static isSupported() {
    return isWasmSupported();
  }
}
