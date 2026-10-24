import type { Square } from "chess.js";
import type { BoardArrow } from "./types";

/** An arrow along a move written in UCI, such as "g1f3" or "e7e8q". */
export const arrowFromUci = (
  uci: string,
  rest: Omit<BoardArrow, "from" | "to">
): BoardArrow => ({
  from: uci.slice(0, 2) as Square,
  to: uci.slice(2, 4) as Square,
  ...rest,
});
