import { getPreviousBestMoveHint } from "@/lib/bestMoveHint";
import { MoveClassification } from "@/types/enums";
import { positionFor } from "@/lib/currentPosition";
import { linesToTopMoves } from "@/lib/engine/topMoves";
import { CurrentPosition, PositionEval } from "@/types/eval";
import { Move } from "chess.js";
import { ArrowPrefs } from "./prefs";
import { ArrowTuning, MISSED_GRADES } from "./tuning";
import { BoardArrow } from "./types";
import { arrowFromUci } from "./uci";

const NO_ARROWS: readonly BoardArrow[] = [];

const sideToMove = (fen: string): "w" | "b" =>
  fen.split(" ")[1] === "b" ? "b" : "w";

/**
 * The better move to draw for the last move, only when that move earned one of
 * the grades the user asked for; an excellent move needs no better one drawn.
 */
export const getMissedMoveHint = (
  position: CurrentPosition,
  grades: readonly MoveClassification[]
): string | undefined => {
  const classification = position.eval?.moveClassification;
  if (!classification || !grades.includes(classification)) return undefined;
  return getPreviousBestMoveHint(position);
};

/**
 * What is known about the last move when it is not the board's own snapshot:
 * in Play, the coach grades the player's move while the bot's reply may
 * already be on the board.
 */
export interface LastMoveFeedback {
  move: Move;
  /** The evaluation of the position the move was made in. */
  before: PositionEval;
  classification: MoveClassification;
}

interface Extras {
  threats?: readonly BoardArrow[];
  feedback?: LastMoveFeedback;
}

/**
 * Every engine arrow the user's choices ask for on the board showing `fen`.
 * The position is read only through `positionFor`, so a snapshot that belongs
 * to the previous board can never put the other side's moves on this one.
 * Moves are drawn once the search has reached the depth the user asked to wait
 * for, because the first lines of a search jump between moves.
 */
export const buildEngineArrows = (
  position: CurrentPosition,
  fen: string,
  prefs: ArrowPrefs,
  tuning: ArrowTuning,
  { threats = NO_ARROWS, feedback }: Extras = {}
): BoardArrow[] => {
  if (!prefs.enabled) return [];

  const snapshot = positionFor(position, fen);
  const mover = sideToMove(fen);
  const arrows: BoardArrow[] = [];

  if (prefs.moves > 0) {
    const lines = snapshot.eval?.lines ?? [];
    const settled = (lines[0]?.depth ?? 0) >= tuning.settleDepth;
    const moves = settled ? linesToTopMoves(fen, lines, prefs.moves) : [];

    for (const move of moves) {
      arrows.push(
        arrowFromUci(move.uci, {
          kind: move.rank === 1 ? "best" : "candidate",
          rank: move.rank,
          side: mover,
        })
      );
    }

    // The line belongs to the best move; the replies alternate between sides.
    // Each move is read from the moves before it, since its origin depends on them.
    const pv = moves[0]?.pvUci ?? [];
    pv.slice(1, 1 + prefs.ahead).forEach((uci, index) => {
      arrows.push(
        arrowFromUci(uci, {
          kind: "line",
          side: index % 2 === 0 ? (mover === "w" ? "b" : "w") : mover,
          label: String(index + 2),
          history: pv.slice(0, index + 1),
        })
      );
    });
  }

  // The last move is the board's own, unless the coach graded it.
  const lastMove: CurrentPosition = feedback
    ? {
        lastMove: feedback.move,
        lastEval: feedback.before,
        eval: { lines: [], moveClassification: feedback.classification },
      }
    : snapshot;
  if (prefs.missed && lastMove.lastMove) {
    const missed = getMissedMoveHint(
      lastMove,
      MISSED_GRADES[tuning.missedFrom]
    );
    if (missed) {
      // The better move starts from where the mover stood before the move played,
      // so it is read from the board after that move. A feedback snapshot may
      // be a move or two further on, where that origin cannot be read, so it
      // carries no history and is never masked.
      const played = lastMove.lastMove;
      arrows.push(
        arrowFromUci(missed, {
          kind: "missed",
          side: played.color,
          history: feedback
            ? undefined
            : [`${played.from}${played.to}${played.promotion ?? ""}`],
        })
      );
    }
  }

  if (prefs.threats) arrows.push(...threats);

  return arrows;
};
