import { Chess, Square } from "chess.js";
import { GameEnd, getGameResult } from "./gameResult";
import { chessPathKey } from "./chessHistory";

export interface BoardDraw {
  reason: string;
  kings: { square: Square; color: "w" | "b" }[];
}

export function getBoardDraw(
  position: Chess | string,
  end: GameEnd | null = null,
  recordedDraw = false
): BoardDraw | null {
  let game: Chess;
  try {
    game = typeof position === "string" ? new Chess(position) : position;
  } catch {
    // Incomplete scan previews do not establish a game result.
    return null;
  }
  const result = getGameResult(game, end);
  if (result.result !== "1/2-1/2" && !(recordedDraw && result.result === "*"))
    return null;
  const kings: BoardDraw["kings"] = [];
  for (const row of game.board()) {
    for (const piece of row) {
      if (piece?.type === "k")
        kings.push({ square: piece.square, color: piece.color });
    }
  }
  return { reason: result.reason || "Draw (recorded game result)", kings };
}

/** PGN results describe their endpoint, not every earlier replay position. */
export const recordedDrawAtEnd = (board: Chess, full: Chess) =>
  full.getHeaders().Result === "1/2-1/2" &&
  chessPathKey(board) === chessPathKey(full);
