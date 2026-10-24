import { loadGameFromText } from "@/lib/pgn";
import { Chess } from "chess.js";

/**
 * SAN and the final FEN cannot identify a path (roots and transpositions differ).
 * The root must come from one source for every ply: chess.js's own FEN of the
 * start position. A FEN header is the raw input text and can differ from it
 * (for example an en-passant square with no capture), which would make a board
 * at its start look unrelated to the same game one move later.
 */
export const chessPath = (game: Chess) => {
  const history = game.history({ verbose: true });
  return {
    root: history[0]?.before ?? game.fen(),
    moves: history.map((move) => move.lan),
    sans: history.map((move) => move.san),
  };
};

export const chessPathKey = (game: Chess) => {
  const { root, moves } = chessPath(game);
  return `${root}|${moves.join(",")}`;
};

export const isChessPrefix = (prefix: Chess, full: Chess) => {
  const a = chessPath(prefix);
  const b = chessPath(full);
  return (
    a.root === b.root &&
    a.moves.length <= b.moves.length &&
    a.moves.every((move, index) => move === b.moves[index])
  );
};

export const replayChess = (game: Chess, ply: number): Chess => {
  const length = game.history().length;
  if (!Number.isInteger(ply) || ply < 0 || ply > length)
    throw new Error("Invalid replay position.");
  const replay = loadGameFromText(game.pgn());
  for (let current = length; current > ply; current--) replay.undo();
  return replay;
};

export const replayState = (board: Chess, full: Chess) => ({
  canGoNext:
    board.history().length < full.history().length &&
    isChessPrefix(board, full),
  atEnd: chessPathKey(board) === chessPathKey(full),
  plies: board.history().length,
});

export type ReplayAction = "start" | "previous" | "next" | "end";

export const navigateChess = (
  board: Chess,
  full: Chess,
  action: ReplayAction
): Chess => {
  const state = replayState(board, full);
  if (action === "next")
    return state.canGoNext ? replayChess(full, state.plies + 1) : board;
  if (action === "end")
    return state.atEnd ? board : replayChess(full, full.history().length);
  if (!state.plies) return board;
  return replayChess(board, action === "start" ? 0 : state.plies - 1);
};
