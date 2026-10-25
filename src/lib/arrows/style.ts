import type { ArrowPalette } from "./palette";
import type { ArrowSide, BoardArrow } from "./types";

/** How far a checker's second tone is lifted towards white. */
const CHECKER_LIFT = 0.45;

export interface ArrowStyle {
  color: string;
  /** Full width of the shaft, in board units where a square is 1. */
  width: number;
  opacity: number;
  headLength: number;
  headHalfWidth: number;
  /** A checker of two tones of the same hue, rather than one solid colour. */
  checkered: boolean;
}

/**
 * Who moves is the hue: the side to move takes the palette's first hue and the
 * other side its second, whichever way the board is turned. A move without a
 * side counts as the side to move.
 */
export const ownerColor = (
  side: ArrowSide | undefined,
  turn: ArrowSide,
  palette: ArrowPalette
): string => (!side || side === turn ? palette.toMove : palette.other);

/** The second tone of a checker: the same hue, lifted towards white. */
export const checkerTint = (hex: string): string => {
  const value = parseInt(hex.slice(1), 16);
  const lift = (channel: number) =>
    Math.round(channel + (255 - channel) * CHECKER_LIFT);
  return `rgb(${lift(value >> 16)}, ${lift((value >> 8) & 255)}, ${lift(value & 255)})`;
};

export const colorWithOpacity = (hex: string, opacity: number): string => {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
};

const DIMMED = 0.3;

/** Proportions shared by every arrow, so its head matches its shaft. */
const sized = (
  width: number,
  color: string,
  opacity: number,
  checkered = false
): ArrowStyle => ({
  color,
  width,
  opacity,
  headLength: width * 2.2,
  headHalfWidth: width * 1.5,
  checkered,
});

/**
 * The best move is the widest and fully opaque. Every other candidate steps
 * down in both width and opacity with its rank, so the eye reads the order at
 * a glance: the first is solid, the rest are progressively see-through.
 */
export const rankedStyle = (rank: number, color: string): ArrowStyle => {
  if (rank <= 1) return sized(0.2, color, 1);

  const steps = rank - 2;
  return sized(
    Math.max(0.12, 0.17 - steps * 0.02),
    color,
    Math.max(0.3, 0.6 - steps * 0.1)
  );
};

/** Who moves is the hue, when it happens is the line style, and what it is shows in the width and opacity. */
export const arrowStyle = (
  arrow: BoardArrow,
  turn: ArrowSide,
  palette: ArrowPalette
): ArrowStyle => {
  const ranks = [arrow, ...(arrow.roles ?? [])].flatMap((role) =>
    role.kind === "best" ? [1] : role.rank ? [role.rank] : []
  );
  const style = baseStyle(
    ranks.length ? { ...arrow, rank: Math.min(...ranks) } : arrow,
    ownerColor(arrow.side, turn, palette),
    palette
  );
  return arrow.dimmed ? { ...style, opacity: style.opacity * DIMMED } : style;
};

const baseStyle = (
  arrow: BoardArrow,
  owner: string,
  palette: ArrowPalette
): ArrowStyle => {
  switch (arrow.kind) {
    case "best":
      return rankedStyle(1, owner);
    case "planned":
      return rankedStyle(arrow.rank ?? 2, owner);
    case "candidate":
      return rankedStyle(arrow.rank ?? 2, owner);
    case "line":
      // A later move of the line: clearly below the best move, but still readable.
      return sized(0.12, owner, 0.55);
    case "missed":
      return sized(0.16, owner, 1, true);
    case "threat":
      return sized(0.16, owner, 0.95);
    case "content":
      return sized(0.16, arrow.color ?? palette.toMove, 0.9);
    case "ink":
      return sized(0.12, arrow.color ?? "#3a9d5d", 1);
  }
};
