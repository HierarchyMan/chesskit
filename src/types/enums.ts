export enum GameOrigin {
  Pgn = "pgn",
  ChessCom = "chesscom",
  Lichess = "lichess",
}

export enum EngineName {
  Reckless = "reckless",
  Stockfish19 = "stockfish_19",
  Stockfish19Lite = "stockfish_19_lite",
  Stockfish19Asm = "stockfish_19_asm",
  Stockfish18 = "stockfish_18",
  Stockfish18Lite = "stockfish_18_lite",
  Stockfish17_1 = "stockfish_17_1",
  Stockfish17_1Lite = "stockfish_17_1_lite",
  Stockfish17 = "stockfish_17",
  Stockfish17Lite = "stockfish_17_lite",
  Stockfish16_1 = "stockfish_16_1",
  Stockfish16_1Lite = "stockfish_16_1_lite",
  Stockfish16NNUE = "stockfish_16_nnue",
  Stockfish16 = "stockfish_16",
  Stockfish11 = "stockfish_11",
  LozzaNNUE = "lozza_nnue",
  LozzaMini = "lozza_mini",
  LozzaHCE = "lozza_hce",
  LozzaMat = "lozza_mat",
  LozzaBeal = "lozza_beal",
  Tomitank = "tomitank_7",
  Drawfish = "joke_drawfish",
  Worstfish = "joke_worstfish",
  RandomMover = "joke_random",
  Alphabetical = "joke_alphabetical",
  Cccp = "joke_cccp",
  Pacifist = "joke_pacifist",
  Bongcloud = "joke_bongcloud",
  Swarm = "joke_swarm",
  Huddle = "joke_huddle",
  Generous = "joke_generous",
}

// Native engines that the bridge lists from engines/engines.json, beside the built-in ones.
export type NativeEngineId = `native:${string}`;
export type EngineId = EngineName | NativeEngineId;

export enum MoveClassification {
  Blunder = "blunder",
  Mistake = "mistake",
  Inaccuracy = "inaccuracy",
  Okay = "okay",
  Excellent = "excellent",
  Best = "best",
  Forced = "forced",
  Opening = "opening",
  Perfect = "perfect",
  Splendid = "splendid",
}

export enum Color {
  White = "w",
  Black = "b",
}
