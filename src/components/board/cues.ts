import { Square } from "react-chessboard/dist/chessboard/types";

/** The squares of the move that led to the position on the board. */
export interface LastMoveCue {
  from: Square;
  to: Square;
  /** A move the user is told was wrong is tinted red instead of yellow. */
  tone?: "bad";
}

/** A verdict on the move just played, drawn on the square it went to. */
export interface VerdictCue {
  square: Square;
  kind: "correct" | "wrong";
}

/** What a page asks the board to point out, beyond the pieces themselves. */
export interface BoardCues {
  lastMove?: LastMoveCue;
  /** A square to ring, such as the piece a hint says to move. */
  hint?: Square;
}
