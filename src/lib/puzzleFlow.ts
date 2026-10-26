import { Chess } from "chess.js";

/**
 * How long each beat of a puzzle lasts at "normal" piece animation, in
 * milliseconds. The pauses scale with the user's piece-animation speed, so a
 * slower setting also gives a slower, more readable puzzle.
 */
export const PUZZLE_PACE = {
  /** The starting position stays on screen before the opponent's last move is played. */
  setup: 1200,
  /** After the solver's move, before the opponent answers. */
  reply: 1500,
  /** A wrong move stays on the board, with its cross, before it slides back. */
  wrong: 1800,
  /** Between the moves of a solution that is being shown. */
  solution: 1800,
} as const;

/** How long the user wants each puzzle pause to last. */
export type MoveTime = "fast" | "medium" | "slow";

export const MOVE_TIMES: { id: MoveTime; label: string; pace: number }[] = [
  { id: "fast", label: "Fast", pace: 0.5 },
  { id: "medium", label: "Med", pace: 1 },
  { id: "slow", label: "Slow", pace: 2 },
];

export const DEFAULT_MOVE_TIME: MoveTime = "medium";

export const isMoveTime = (value: unknown): value is MoveTime =>
  MOVE_TIMES.some(({ id }) => id === value);

/** Even with animation off, a beat never shrinks below this share of its length. */
const MIN_PACE = 0.5;

export const pacedMs = (
  baseMs: number,
  motionScale: number,
  moveTime: MoveTime = DEFAULT_MOVE_TIME
): number => {
  const pace = MOVE_TIMES.find(({ id }) => id === moveTime)?.pace ?? 1;
  return Math.round(baseMs * Math.max(motionScale, MIN_PACE) * pace);
};

export interface LineMove {
  /** Plies played from the start of the board's game, counting the setup move. */
  ply: number;
  san: string;
  color: "w" | "b";
  /** The move number as chess notation counts it. */
  number: number;
  /** A move the solver makes, as against the opponent's answer. */
  mine: boolean;
}

/**
 * The moves of the puzzle's line, in the order played. The opponent's setup
 * move belongs to the position, not the line, so it is left out.
 */
export const lineFromGame = (
  game: Chess,
  setupPlies: number,
  solver: "w" | "b"
): LineMove[] =>
  game
    .history({ verbose: true })
    .map((move, index) => ({
      ply: index + 1,
      san: move.san,
      color: move.color,
      number: Number(move.before.split(" ")[5]) || 1,
      mine: move.color === solver,
    }))
    .slice(setupPlies);

/** "1. Qh6 gxh6 2. Rxh6#", or "1... Qh6" when the line starts with Black. */
export const formatLine = (line: readonly LineMove[]): string =>
  line
    .map((move, index) => {
      if (move.color === "w") return `${move.number}. ${move.san}`;
      return index === 0 ? `${move.number}... ${move.san}` : move.san;
    })
    .join(" ");
