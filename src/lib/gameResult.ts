import { Color } from "@/types/enums";
import { Chess, Color as ChessColor } from "chess.js";
import { GameOutcome } from "./stats";

export type GameEnd =
  | { type: "resign"; loser: Color }
  | { type: "timeout"; loser: Color }
  | { type: "draw-agreed" };

export type PgnResult = "1-0" | "0-1" | "1/2-1/2" | "*";

export interface GameResultInfo {
  over: boolean;
  winner?: Color;
  result: PgnResult;
  reason: string;
}

const otherColor = (color: Color): Color =>
  color === Color.White ? Color.Black : Color.White;

const resultForWinner = (winner: Color): PgnResult =>
  winner === Color.White ? "1-0" : "0-1";

export const hasMatingMaterial = (game: Chess, color: ChessColor): boolean => {
  const pieces = game
    .board()
    .flat()
    .filter((square) => square && square.type !== "k");

  const own = pieces.filter((piece) => piece?.color === color);
  const opponent = pieces.filter((piece) => piece?.color !== color);

  if (own.some((piece) => ["p", "r", "q"].includes(piece?.type ?? ""))) {
    return true;
  }

  if (own.length >= 2) return true;
  return own.length === 1 && opponent.length > 0;
};

export const getGameResult = (game: Chess, end: GameEnd | null): GameResultInfo => {
  if (end?.type === "resign") {
    const winner = otherColor(end.loser);
    return { over: true, winner, result: resultForWinner(winner), reason: "Resignation" };
  }

  if (end?.type === "draw-agreed") {
    return { over: true, result: "1/2-1/2", reason: "Draw by agreement" };
  }

  if (end?.type === "timeout") {
    const winner = otherColor(end.loser);
    if (!hasMatingMaterial(game, winner)) {
      return {
        over: true,
        result: "1/2-1/2",
        reason: "Timeout, but the opponent cannot checkmate",
      };
    }
    return { over: true, winner, result: resultForWinner(winner), reason: "Timeout" };
  }

  if (game.isCheckmate()) {
    const winner = otherColor(game.turn() as Color);
    return { over: true, winner, result: resultForWinner(winner), reason: "Checkmate" };
  }

  if (game.isStalemate()) return { over: true, result: "1/2-1/2", reason: "Stalemate" };
  if (game.isInsufficientMaterial()) {
    return { over: true, result: "1/2-1/2", reason: "Insufficient material" };
  }
  if (game.isThreefoldRepetition()) {
    return { over: true, result: "1/2-1/2", reason: "Threefold repetition" };
  }
  if (game.isDraw()) return { over: true, result: "1/2-1/2", reason: "Fifty-move rule" };

  return { over: false, result: "*", reason: "" };
};

export const getOutcomeFor = (
  info: GameResultInfo,
  player: Color
): GameOutcome => {
  if (!info.winner) return "drawn";
  return info.winner === player ? "won" : "lost";
};
