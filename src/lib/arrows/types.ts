import type { Square } from "chess.js";

/**
 * What an arrow means. The kind, never the producer, decides how it looks:
 * a move to play now, an alternative, a later move of the engine's line, the
 * move that should have been played, a threat, a move an engine has decided
 * on, a page's own teaching arrow, or the user's own drawing.
 */
export type ArrowKind =
  | "best"
  | "candidate"
  | "line"
  | "missed"
  | "threat"
  | "planned"
  | "content"
  | "ink";

/** The two sides of a chess board, by the colour of their pieces. */
export type ArrowSide = "w" | "b";

export interface BoardArrow {
  from: Square;
  to: Square;
  kind: ArrowKind;
  /**
   * The side making the move. Its colour, against the side to move on the
   * displayed position, decides the hue, so the same arrow is never recoloured
   * by flipping the board or by which player the user is.
   */
  side?: ArrowSide;
  /** Candidate rank, where 1 is the best move. */
  rank?: number;
  /** Short text on the arrowhead, such as the ply number of a line. */
  label?: string;
  /** Further ply numbers that a merged arrow also stands for, such as a line that revisits its squares. */
  alsoLabels?: readonly string[];
  /** Explicit colour, for content and ink arrows only. */
  color?: string;
  /** Pushed back while another arrow is the focus, such as a hovered row. */
  dimmed?: boolean;
  /**
   * Where the origin comes from, in UCI. For a line move, the moves of the
   * engine's line before it, counted from the displayed position, which are
   * still to be played. For a missed move, the move that was played, which is
   * already on the displayed board. Either way it says whether the origin still
   * holds the piece that makes this move.
   */
  history?: readonly string[];
  /**
   * The piece standing on the origin that this arrow's own move starts from,
   * such as "wN". Set only when that piece is the mover, so the arrow can pass
   * behind it; it is never a piece that happens to stand on the square.
   */
  sourcePiece?: string;
}

/** Which arrows a legend entry or a hovered row stands for. */
export interface ArrowFocus {
  kind: ArrowKind;
  side?: ArrowSide;
  rank?: number;
}

/** Drawn later wins when two arrows join the same two squares. */
export const ARROW_PRIORITY: Record<ArrowKind, number> = {
  candidate: 1,
  line: 2,
  missed: 3,
  content: 4,
  best: 5,
  planned: 6,
  threat: 7,
  ink: 8,
};

export const isArrowFocused = (arrow: BoardArrow, focus: ArrowFocus): boolean =>
  arrow.kind === focus.kind &&
  (focus.side === undefined || arrow.side === focus.side) &&
  (focus.rank === undefined || arrow.rank === focus.rank);
