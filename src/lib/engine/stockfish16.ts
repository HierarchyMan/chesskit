import { EngineName } from "@/types/enums";
import { UciEngine } from "./uciEngine";
import { isWasmSupported } from "./shared";
import { sendCommandsToWorker } from "./worker";
import { EngineWorker } from "@/types/engine";
import { ENGINE_MODELS } from "./models";

export class Stockfish16 {
  public static async create(
    nnue?: boolean,
    signal?: AbortSignal
  ): Promise<UciEngine> {
    if (!Stockfish16.isSupported()) {
      throw new Error("Stockfish 16 is not supported");
    }

    const customEngineInit = async (worker: EngineWorker) => {
      await sendCommandsToWorker(
        worker,
        [`setoption name Use NNUE value ${!!nnue}`, "isready"],
        "readyok"
      );
    };

    const engineName = nnue
      ? EngineName.Stockfish16NNUE
      : EngineName.Stockfish16;

    return UciEngine.create(
      engineName,
      ENGINE_MODELS[engineName].script,
      customEngineInit,
      signal
    );
  }

  public static isSupported() {
    return isWasmSupported();
  }
}
