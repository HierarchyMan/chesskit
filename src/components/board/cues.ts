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

/** Semantic tone for coach or analysis square highlights. */
export type HighlightTone =
  | "selected"
  | "bright"
  | "mentioned"
  | "danger"
  | "success";

export interface SquareHighlight {
  square: Square;
  tone: HighlightTone;
  pulse?: boolean;
}

/** Transient board micro-effect anchored to a square. */
export interface BoardEffect {
  square: Square;
  kind: "shake_king" | "spin_king" | "point_earned" | "progress_made";
  key?: number;
}

/** What a page asks the board to point out, beyond the pieces themselves. */
export interface BoardCues {
  lastMove?: LastMoveCue;
  /** A square to ring, such as the piece a hint says to move. */
  hint?: Square;
  /** Multi-square semantic highlights (e.g. hanging piece, key square). */
  highlights?: readonly SquareHighlight[];
  /** Optional transient square animation (king shake/spin, progress badge). */
  effect?: BoardEffect;
}
