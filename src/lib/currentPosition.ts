import { CurrentPosition } from "@/types/eval";

const EMPTY: CurrentPosition = {};

/**
 * A position snapshot is published by an effect after the board changes, so
 * for at least one render the board and its snapshot disagree. The previous
 * snapshot's lines and best move belong to the other side to move. Engine
 * suggestions must only be read through this check, never straight from the
 * snapshot.
 */
export const positionFor = (
  position: CurrentPosition,
  fen: string
): CurrentPosition => (position.fen === fen ? position : EMPTY);
