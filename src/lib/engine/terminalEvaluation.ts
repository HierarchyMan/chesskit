import { Chess } from "chess.js";
import { PositionEval } from "@/types/eval";

/** Full history is required: a FEN alone cannot establish threefold repetition. */
export const terminalEvaluation = (
  game: Chess,
  depth = 0
): PositionEval | undefined => {
  if (!game.isGameOver()) return undefined;
  return {
    lines: [
      {
        pv: [],
        depth,
        multiPv: 1,
        ...(game.isCheckmate()
          ? { mate: game.turn() === "w" ? -1 : 1 }
          : { cp: 0 }),
      },
    ],
  };
};
