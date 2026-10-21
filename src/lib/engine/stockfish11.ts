import { EngineName } from "@/types/enums";
import { UciEngine } from "./uciEngine";
import { ENGINE_MODELS } from "./models";

export class Stockfish11 {
  public static async create(): Promise<UciEngine> {
    return UciEngine.create(
      EngineName.Stockfish11,
      ENGINE_MODELS[EngineName.Stockfish11].script
    );
  }

  public static isSupported() {
    return true;
  }
}
