import { CurrentPosition } from "@/types/eval";
import { MoveClassification } from "@/types/enums";
import { Chess } from "chess.js";
import { uciMoveParams } from "./chess";
import { WORTH_VISUALIZING } from "./classificationLabels";

const legalMove = (fen: string | undefined, uci: string | undefined) => {
  if (!fen || !uci || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    return undefined;
  }
  try {
    const game = new Chess(fen);
    if (game.isGameOver()) return undefined;
    return game.move(uciMoveParams(uci));
  } catch {
    return undefined;
  }
};

/** A legal suggestion for the side to move on this snapshot's board. */
export const getBestMoveSuggestion = (position: CurrentPosition) => {
  const candidate = position.eval?.bestMove ?? position.eval?.lines[0]?.pv[0];
  return legalMove(position.fen, candidate);
};

export const getBestMoveHint = (
  position: CurrentPosition
): string | undefined => getBestMoveSuggestion(position)?.lan;

// These grades already say the played move was the best, book or forced
// choice, so an arrow to a different move would contradict the grade.
const SILENT_CLASSIFICATIONS: readonly MoveClassification[] = [
  MoveClassification.Best,
  MoveClassification.Opening,
  MoveClassification.Forced,
  MoveClassification.Perfect,
];

/**
 * The engine's better alternative to the last move, as UCI, or undefined when
 * no alternative should be shown. This is retrospective feedback, never a
 * suggestion to draw on the current board.
 */
export const getPreviousBestMoveHint = (
  position: CurrentPosition
): string | undefined => {
  const bestMove = position.lastEval?.bestMove;
  const played = position.lastMove;
  if (!bestMove || !played || bestMove === played.lan) return undefined;

  const classification = position.eval?.moveClassification;
  if (classification && SILENT_CLASSIFICATIONS.includes(classification)) {
    return undefined;
  }

  return legalMove(played.before, bestMove)?.lan;
};

/** Keep the previous side and the actual played move explicit in both modes. */
export const getPreviousBestMoveFeedback = (position: CurrentPosition) => {
  const uci = getPreviousBestMoveHint(position);
  const played = position.lastMove;
  if (!uci || !played) return undefined;
  const alternative = legalMove(played.before, uci);
  if (!alternative) return undefined;
  const number = played.before.split(" ")[5];
  const playedLabel = `${number}${played.color === "w" ? "." : "…"}${played.san}`;
  return {
    alternative,
    context: `Before ${played.color === "w" ? "White" : "Black"} played ${playedLabel}`,
  };
};

/** Grades and playable stories remain available even without a bestmove. */
export const getMoveFeedback = (position: CurrentPosition) => {
  const classification = position.eval?.moveClassification;
  return {
    classification,
    previousBestMove: getPreviousBestMoveFeedback(position),
    canVisualize:
      !!position.lastMove &&
      !!position.lastEval?.lines.length &&
      !!position.eval?.lines.length &&
      !!classification &&
      WORTH_VISUALIZING.includes(classification),
  };
};
