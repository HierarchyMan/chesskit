import { Chess, Square } from "chess.js";
import { Puzzle } from "./puzzles";
import { puzzleMotifs } from "./puzzleThemes";

export const PIECE_NAMES: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

export type PuzzleHint =
  | { kind: "motif"; text: string }
  | { kind: "piece"; text: string; square: Square }
  | { kind: "move"; text: string; from: Square; to: Square };

/** What a solver with no idea where to look is told first. */
const GENERAL_NUDGE =
  "Look at every check, capture and threat, yours and theirs, before you pick a move.";

/**
 * The hints for the move the solver has to find, from the vaguest to the
 * answer. The last one gives the move away, so using it is help. Each hint
 * narrows the one before it: the idea, then the piece, then the move itself.
 */
export const buildHints = (
  puzzle: Puzzle,
  fen: string,
  step: number
): PuzzleHint[] => {
  const uci = puzzle.solution[step];
  if (!uci) return [];

  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const piece = new Chess(fen).get(from);
  if (!piece) return [];

  const name = PIECE_NAMES[piece.type];
  const [motif] = puzzleMotifs(puzzle.themes);
  const hints: PuzzleHint[] = [];

  // The idea is named once; later moves of the line are about the piece.
  if (step === 0) {
    hints.push({ kind: "motif", text: motif?.hint ?? GENERAL_NUDGE });
  }

  hints.push({ kind: "piece", text: `Move your ${name}.`, square: from });
  hints.push({
    kind: "move",
    text: `Your ${name} goes to ${to}.`,
    from,
    to,
  });

  return hints;
};
