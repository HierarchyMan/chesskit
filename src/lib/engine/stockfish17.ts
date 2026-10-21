import { EngineName } from "@/types/enums";
import { UciEngine } from "./uciEngine";
import { isWasmSupported } from "./shared";
import { ENGINE_MODELS } from "./models";

export class Stockfish17 {
  public static async create(lite?: boolean): Promise<UciEngine> {
    if (!Stockfish17.isSupported()) {
      throw new Error("Stockfish 17 is not supported");
    }

    const engineName = lite
      ? EngineName.Stockfish17Lite
      : EngineName.Stockfish17;

    return UciEngine.create(engineName, ENGINE_MODELS[engineName].script);
  }

  public static isSupported() {
    return isWasmSupported();
  }
}
