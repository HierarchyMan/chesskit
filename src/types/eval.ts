import { Move } from "chess.js";
import { EngineId, MoveClassification } from "./enums";

export interface PositionEval {
  bestMove?: string;
  moveClassification?: MoveClassification;
  opening?: string;
  lines: LineEval[];
}

export interface LineEval {
  pv: string[];
  cp?: number;
  mate?: number;
  depth: number;
  multiPv: number;
  // Only a bound from an unfinished search, not an exact score.
  bound?: boolean;
}

export interface Accuracy {
  white: number | null;
  black: number | null;
}

export interface EstimatedElo {
  white: number | null;
  black: number | null;
}

export interface EngineSettings {
  engine: EngineId;
  depth: number;
  multiPv: number;
  date: string;
}

export interface GameEval {
  positions: PositionEval[];
  accuracy: Accuracy;
  estimatedElo?: EstimatedElo;
  settings: EngineSettings;
}

export interface EvaluatePositionWithUpdateParams {
  fen: string;
  depth?: number;
  multiPv?: number;
  setPartialEval?: (positionEval: PositionEval) => void;
  useCloudEval?: boolean;
  movetimeMs?: number;
  elo?: number;
}

export interface CurrentPosition {
  /** The board FEN this snapshot describes; see positionFor. */
  fen?: string;
  lastMove?: Move;
  eval?: PositionEval;
  lastEval?: PositionEval;
  currentMoveIdx?: number;
  opening?: string;
}

export interface EvaluateGameParams {
  fens: string[];
  uciMoves: string[];
  terminalPositions?: Record<number, PositionEval>;
  depth?: number;
  multiPv?: number;
  setEvaluationProgress?: (value: number) => void;
  playersRatings?: { white?: number; black?: number };
  workersNb?: number;
}

export interface SavedEval {
  bestMove?: string;
  lines: LineEval[];
  engine: EngineId;
}

export type SavedEvals = Record<string, SavedEval | undefined>;
