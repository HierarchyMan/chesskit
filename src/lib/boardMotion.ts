export interface MotionPiece {
  id: string;
  square: string;
  piece: string;
}
export const pieceSquarePoint = (
  square: string,
  orientation: "white" | "black"
) => {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return orientation === "white"
    ? { x: file, y: 7 - rank }
    : { x: 7 - file, y: rank };
};

/** Preserve stationary identities first, then match moved pieces one-to-one.
 * Castling, promotion/undo, captures and arbitrary editor changes all use the same rule. */
export const matchMotionPieces = (
  previous: MotionPiece[],
  next: Record<string, string | undefined>,
  newId: () => string
) => {
  const unused = new Set(previous);
  const result: MotionPiece[] = [];
  const entries = Object.entries(next).filter(
    (entry): entry is [string, string] => !!entry[1]
  );
  for (const [square, piece] of entries) {
    const same = previous.find(
      (entry) =>
        unused.has(entry) && entry.square === square && entry.piece === piece
    );
    if (same) {
      unused.delete(same);
      result.push(same);
    }
  }
  for (const [square, piece] of entries) {
    if (result.some((entry) => entry.square === square)) continue;
    const compatible = [...unused].filter(
      (entry) =>
        entry.piece === piece ||
        (entry.square !== square &&
          entry.piece[0] === piece[0] &&
          (entry.piece[1] === "P" || piece[1] === "P") &&
          (entry.square[1] === "1" ||
            entry.square[1] === "8" ||
            square[1] === "1" ||
            square[1] === "8"))
    );
    const distance = (entry: MotionPiece) =>
      Math.abs(entry.square.charCodeAt(0) - square.charCodeAt(0)) +
      Math.abs(Number(entry.square[1]) - Number(square[1]));
    const from = compatible.sort((a, b) => distance(a) - distance(b))[0];
    if (from) unused.delete(from);
    result.push({ id: from?.id ?? newId(), square, piece });
  }
  return { pieces: result, removed: [...unused] };
};
