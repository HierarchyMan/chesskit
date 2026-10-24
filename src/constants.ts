import { EngineName, MoveClassification } from "./types/enums";

export const MAIN_THEME_COLOR = "#3B9AC6";
export const LINEAR_PROGRESS_BAR_COLOR = "#3B9AC6";

export const CLASSIFICATION_COLORS: Record<MoveClassification, string> = {
  [MoveClassification.Opening]: "#dbac86",
  [MoveClassification.Forced]: "#dbac86",
  [MoveClassification.Splendid]: "#19d4af",
  [MoveClassification.Perfect]: "#3894eb",
  [MoveClassification.Best]: "#22ac38",
  [MoveClassification.Excellent]: "#22ac38",
  [MoveClassification.Okay]: "#74b038",
  [MoveClassification.Inaccuracy]: "#f2be1f",
  [MoveClassification.Mistake]: "#e69f00",
  [MoveClassification.Blunder]: "#df5353",
};

export const DEFAULT_ENGINE: EngineName = EngineName.Stockfish18Lite;
export const STRONGEST_ENGINE: EngineName = EngineName.Stockfish18;

export const ENGINE_LABELS: Record<
  EngineName,
  { small: string; full: string }
> = {
  [EngineName.Reckless]: {
    full: "Reckless 0.9.0 (local bridge)",
    small: "Reckless",
  },
  [EngineName.Stockfish18]: {
    full: "Stockfish 18",
    small: "Stockfish 18",
  },
  [EngineName.Stockfish18Lite]: {
    full: "Stockfish 18 Lite",
    small: "Stockfish 18 Lite",
  },
  [EngineName.Stockfish17_1]: {
    full: "Stockfish 17.1",
    small: "Stockfish 17.1",
  },
  [EngineName.Stockfish17_1Lite]: {
    full: "Stockfish 17.1 Lite",
    small: "Stockfish 17.1 Lite",
  },
  [EngineName.Stockfish17]: {
    full: "Stockfish 17",
    small: "Stockfish 17",
  },
  [EngineName.Stockfish17Lite]: {
    full: "Stockfish 17 Lite",
    small: "Stockfish 17 Lite",
  },
  [EngineName.Stockfish16_1]: {
    full: "Stockfish 16.1",
    small: "Stockfish 16.1",
  },
  [EngineName.Stockfish16_1Lite]: {
    full: "Stockfish 16.1 Lite",
    small: "Stockfish 16.1 Lite",
  },
  [EngineName.Stockfish16NNUE]: {
    full: "Stockfish 16",
    small: "Stockfish 16",
  },
  [EngineName.Stockfish16]: {
    full: "Stockfish 16 Lite (HCE)",
    small: "Stockfish 16 Lite",
  },
  [EngineName.Stockfish11]: {
    full: "Stockfish 11 (HCE)",
    small: "Stockfish 11",
  },
};

// Stockfish 11 only offers "Skill Level" (checked by sending it "uci"), and
// Reckless has no UCI_Elo either, so both use the emulated strength model.
const ENGINES_WITHOUT_NATIVE_ELO_LIMIT = new Set<EngineName>([
  EngineName.Reckless,
  EngineName.Stockfish11,
]);

export const hasNativeEloLimit = (engine: EngineName): boolean =>
  !ENGINES_WITHOUT_NATIVE_ELO_LIMIT.has(engine);

export const PIECE_SETS = [
  "alpha",
  "anarcandy",
  "caliente",
  "california",
  "cardinal",
  "cburnett",
  "celtic",
  "chess7",
  "chessnut",
  "chicago",
  "companion",
  "cooke",
  "dubrovny",
  "fantasy",
  "firi",
  "fresca",
  "gioco",
  "governor",
  "horsey",
  "icpieces",
  "iowa",
  "kaneo",
  "kiwen-suwi",
  "kosal",
  "leipzig",
  "letter",
  "maestro",
  "merida",
  "monarchy",
  "mpchess",
  "neo",
  "oslo",
  "pirouetti",
  "pixel",
  "reillycraig",
  "rhosgfx",
  "riohacha",
  "shapes",
  "spatial",
  "staunty",
  "symmetric",
  "tatiana",
  "xkcd",
] as const satisfies string[];
