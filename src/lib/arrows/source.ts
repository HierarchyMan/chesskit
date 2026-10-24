import { Chess, type Square } from "chess.js";
import type { BoardArrow } from "./types";

/** Kinds whose origin is a piece that really moves from the displayed board. */
const HAS_ORIGIN = new Set<BoardArrow["kind"]>([
  "best",
  "candidate",
  "line",
  "missed",
  "planned",
  "threat",
  "ink",
]);

/**
 * The squares an earlier move changed. A piece on such a square is no longer
 * the piece that stood there in the displayed position, unless a later move
 * brought the original back, which this conservative reading does not mask.
 * `undefined` means the history does not play out, so nothing can be claimed.
 */
const touchedBy = (
  fen: string,
  history: readonly string[]
): Set<string> | undefined => {
  const game = new Chess(fen);
  const touched = new Set<string>();

  try {
    for (const uci of history) {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const move = game.move({
        from: from as Square,
        to: to as Square,
        promotion: uci[4],
      });
      touched.add(from);
      touched.add(to);
      // An en passant capture removes the pawn beside the destination square.
      if (move.isEnPassant()) touched.add(`${to[0]}${from[1]}`);
      // Castling moves the rook, which the king's squares do not show.
      if (move.isKingsideCastle()) {
        touched.add(`h${from[1]}`);
        touched.add(`f${from[1]}`);
      }
      if (move.isQueensideCastle()) {
        touched.add(`a${from[1]}`);
        touched.add(`d${from[1]}`);
      }
    }
  } catch {
    return undefined;
  }

  return touched;
};

/**
 * The squares a move already on the displayed board changed, read from that
 * board: where it began and ended, the rook of a castle, and the square beside
 * the destination that an en passant capture would have emptied. A missed move
 * is read this way, because the board it is drawn on is the one after the
 * move that was played, and that move can no longer be played from there.
 */
const playedTouches = (fen: string, uci: string): Set<string> => {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const touched = new Set([from, to]);
  const moved = new Chess(fen).get(to as Square);

  if (
    moved?.type === "k" &&
    Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2
  ) {
    const rank = from[1];
    if (to[0] === "g") {
      touched.add(`h${rank}`);
      touched.add(`f${rank}`);
    } else {
      touched.add(`a${rank}`);
      touched.add(`d${rank}`);
    }
  }
  if (moved?.type === "p" && from[0] !== to[0]) {
    touched.add(`${to[0]}${from[1]}`);
  }
  return touched;
};

/**
 * The piece an arrow's move starts from, when that piece stands on the
 * displayed board and is the one that makes the move. The history says which
 * moves came before it: a missed move's history is the move that was played,
 * so its origin is the mover's only if that move did not leave it. An arrow
 * whose history is unknown is never given a piece, and an unrelated occupant
 * of the origin is never mistaken for the mover.
 */
export const sourcePieceFor = (
  fen: string,
  arrow: Pick<BoardArrow, "from" | "side" | "kind" | "history">,
  game: Chess = new Chess(fen)
): string | undefined => {
  if (!HAS_ORIGIN.has(arrow.kind)) return undefined;
  if (arrow.kind === "missed" && !arrow.history) return undefined;

  const piece = game.get(arrow.from);
  if (!piece) return undefined;
  if (arrow.side && piece.color !== arrow.side) return undefined;
  if (arrow.history?.length) {
    const touched =
      arrow.kind === "missed"
        ? playedTouches(fen, arrow.history[0])
        : touchedBy(fen, arrow.history);
    if (!touched || touched.has(arrow.from)) return undefined;
  }

  return `${piece.color}${piece.type.toUpperCase()}`;
};

/**
 * Every arrow with its source piece worked out for the position it is drawn
 * on. Arrows that already have one are returned as they are, so the work is
 * done once per position.
 */
export const withSources = (
  arrows: readonly BoardArrow[],
  fen: string | undefined
): BoardArrow[] => {
  if (!fen || arrows.length === 0) return [...arrows];

  const game = new Chess(fen);
  return arrows.map((arrow) => {
    const sourcePiece = sourcePieceFor(fen, arrow, game);
    return sourcePiece === arrow.sourcePiece
      ? arrow
      : { ...arrow, sourcePiece };
  });
};
