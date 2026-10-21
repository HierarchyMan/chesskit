import { EngineName } from "@/types/enums";
import { UciEngine } from "./uciEngine";
import { isWasmSupported } from "./shared";
import { ENGINE_MODELS } from "./models";

export class Stockfish18 {
  public static async create(lite?: boolean): Promise<UciEngine> {
    if (!Stockfish18.isSupported()) {
      throw new Error("Stockfish 18 is not supported");
    }

    const engineName = lite
      ? EngineName.Stockfish18Lite
      : EngineName.Stockfish18;

    return UciEngine.create(engineName, ENGINE_MODELS[engineName].script);
  }

  public static isSupported() {
    return isWasmSupported();
  }
}
