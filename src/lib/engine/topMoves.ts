import { Chess } from "chess.js";
import { LineEval } from "@/types/eval";
import { getLineEvalLabel, uciMoveParams } from "../chess";

export type MoveSide = "mover" | "opponent";

export interface TopMove {
  rank: number;
  uci: string;
  san: string;
  cp?: number;
  mate?: number;
  evalLabel: string;
  pvSan: string[];
  pvUci: string[];
  depth: number;
}

export type SideFen = { fen: string } | { error: string };

export const getFenForSide = (fen: string, side: MoveSide): SideFen => {
  let game: Chess;
  try {
    game = new Chess(fen);
  } catch {
    return { error: "This position is not valid." };
  }

  if (game.isGameOver()) return { error: "The game is over." };
  if (side === "mover") return { fen };

  if (game.inCheck()) {
    return {
      error:
        "The side to move is in check and must answer it, so the other side has nothing to threaten right now.",
    };
  }

  const fields = fen.split(" ");
  fields[1] = game.turn() === "w" ? "b" : "w";
  fields[3] = "-";
  const flipped = fields.join(" ");

  try {
    const flippedGame = new Chess(flipped);
    if (!flippedGame.moves().length) {
      return { error: "That side has no legal moves in this position." };
    }
  } catch {
    return { error: "This position can't be viewed from the other side." };
  }

  return { fen: flipped };
};

export const linesToTopMoves = (
  fen: string,
  lines: LineEval[],
  max = lines.length
): TopMove[] =>
  lines
    .filter(
      (line, index, all) =>
        line.pv.length > 0 &&
        all.findIndex((other) => other.pv[0] === line.pv[0]) === index
    )
    .slice(0, max)
    .map((line, index) => {
      const game = new Chess(fen);
      const pvSan: string[] = [];
      const pvUci: string[] = [];

      for (const uci of line.pv) {
        try {
          pvSan.push(game.move(uciMoveParams(uci)).san);
          pvUci.push(uci);
        } catch {
          break;
        }
      }

      return {
        rank: index + 1,
        uci: line.pv[0],
        san: pvSan[0] ?? line.pv[0],
        cp: line.cp,
        mate: line.mate,
        evalLabel: getLineEvalLabel(line),
        pvSan,
        pvUci,
        depth: line.depth,
      };
    });

export const formatLine = (fen: string, sanMoves: string[]): string => {
  const fields = fen.split(" ");
  let turn = fields[1];
  let moveNumber = Number(fields[5]) || 1;
  const parts: string[] = [];

  sanMoves.forEach((san, index) => {
    if (turn === "w") parts.push(`${moveNumber}.`);
    else if (index === 0) parts.push(`${moveNumber}...`);

    parts.push(san);

    if (turn === "b") moveNumber++;
    turn = turn === "w" ? "b" : "w";
  });

  return parts.join(" ");
};
