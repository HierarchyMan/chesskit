import { CurrentPosition } from "@/types/eval";
import { MoveClassification } from "@/types/enums";

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
 * no alternative should be shown. Shared by the board arrow and the arena text
 * so both modes agree on when an alternative exists.
 */
export const getBestMoveHint = (
  position: CurrentPosition
): string | undefined => {
  const bestMove = position.lastEval?.bestMove;
  const played = position.lastMove;
  if (!bestMove || !played || bestMove === played.lan) return undefined;

  const classification = position.eval?.moveClassification;
  if (classification && SILENT_CLASSIFICATIONS.includes(classification)) {
    return undefined;
  }

  return bestMove;
};
