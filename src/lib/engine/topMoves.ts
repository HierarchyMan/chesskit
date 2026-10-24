import { Chess } from "chess.js";
import { LineEval } from "@/types/eval";
import { getLineEvalLabel, uciMoveParams } from "../chess";
import { atom, Atom } from "jotai";
import { BoardArrow } from "../arrows/types";

export type MoveSide = "mover" | "opponent";

/** A side choice remembers the position it was made on. */
export interface MoveSideChoice {
  side: MoveSide;
  fen: string | null;
  positionKey?: string;
}

/**
 * "Opponent" is relative to the side to move, so carried to the next ply it
 * silently names the other colour: chosen on White's turn it shows Black, and
 * one move later it would show White while Black is to move, or Black while
 * White is to move. The what-if therefore applies only to the position where
 * it was chosen; any other position shows the side to move.
 */
export const effectiveMoveSide = (
  choice: MoveSideChoice,
  fen: string,
  positionKey?: string
): MoveSide =>
  choice.side === "opponent" &&
  choice.fen === fen &&
  choice.positionKey === positionKey
    ? "opponent"
    : "mover";

/** Retire a relative choice after leaving its position, so undo cannot revive it. */
export const resetMoveSideChoice = (
  choice: MoveSideChoice,
  fen: string,
  positionKey: string
): MoveSideChoice =>
  choice.fen === fen && choice.positionKey === positionKey
    ? choice
    : { side: "mover", fen, positionKey };

export interface PositionArrows {
  positionKey: string;
  arrows: BoardArrow[];
}

const NO_ARROWS: BoardArrow[] = [];

export const arrowsForPosition = (
  snapshot: PositionArrows,
  positionKey: string
): BoardArrow[] =>
  snapshot.positionKey === positionKey ? snapshot.arrows : NO_ARROWS;

/** Read-time ownership also hides old arrows before request effects run. */
export const createPositionArrowsAtom = (positionKeyAtom: Atom<string>) => {
  const snapshotAtom = atom<PositionArrows>({ positionKey: "", arrows: [] });
  return atom(
    (get) => arrowsForPosition(get(snapshotAtom), get(positionKeyAtom)),
    (get, set, update: BoardArrow[] | PositionArrows) => {
      const positionKey = get(positionKeyAtom);
      const snapshot = Array.isArray(update)
        ? { positionKey, arrows: update }
        : update;
      // An old request/cleanup must not publish into a newer position.
      if (snapshot.positionKey === positionKey) set(snapshotAtom, snapshot);
    }
  );
};

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
    })
    .filter((move) => move.pvUci.length > 0)
    .slice(0, max)
    .map((move, index) => ({ ...move, rank: index + 1 }));

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
