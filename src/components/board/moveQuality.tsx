import { squareCenter, Orientation } from "@/lib/arrows/geometry";
import { MoveClassification } from "@/types/enums";
import { CurrentPosition } from "@/types/eval";
import { Square } from "chess.js";
import { PrimitiveAtom, atom, useAtomValue } from "jotai";
import Image from "next/image";
import { useMemo } from "react";

export interface QualityMark {
  square: Square;
  /** Undefined while the engine is still grading the move. */
  classification?: MoveClassification;
}

/**
 * The last move's mark, on its destination, when the user wants the grades
 * shown. It appears as soon as the move is on the board, and takes its grade
 * when the engine has graded it. It is read from the board's own snapshot, so
 * it describes the position on the board and no other.
 */
export const useQualityMark = (
  currentPositionAtom: PrimitiveAtom<CurrentPosition>,
  showAtom: PrimitiveAtom<boolean> | undefined
): QualityMark | undefined => {
  const mark = useMemo(
    () =>
      atom((get): QualityMark | undefined => {
        if (showAtom && !get(showAtom)) return undefined;
        const position = get(currentPositionAtom);
        const to = position.lastMove?.to;
        if (!to) return undefined;
        return {
          square: to,
          classification: position.eval?.moveClassification,
        };
      }),
    [currentPositionAtom, showAtom]
  );
  return useAtomValue(mark);
};

/**
 * The quality mark sits above the arrows and their labels, on the board itself
 * rather than inside a square, which would trap it beneath the arrow layer.
 */
export default function QualityIcon({
  mark,
  orientation,
}: {
  mark: QualityMark;
  orientation: Orientation;
}) {
  const { x, y } = squareCenter(mark.square, orientation);
  const size = "min(40px, calc(var(--board-size) * 0.06))";
  const position = {
    position: "absolute" as const,
    width: size,
    height: size,
    left: `calc(${(x + 0.5) * 12.5}% - ${size} / 2)`,
    top: `calc(${(y - 0.5) * 12.5}% - ${size} / 2)`,
    zIndex: 20,
    pointerEvents: "none" as const,
    userSelect: "none" as const,
  };

  if (!mark.classification) {
    // A neutral marker holds the corner until the grade arrives.
    return (
      <div
        role="status"
        aria-label="Grading the move"
        style={{
          ...position,
          borderRadius: "50%",
          border: "2px solid rgba(255, 255, 255, 0.85)",
          backgroundColor: "rgba(40, 40, 40, 0.55)",
          boxSizing: "border-box",
        }}
      />
    );
  }

  return (
    <Image
      src={`/icons/${mark.classification}.png`}
      alt={`${mark.classification} move`}
      width={40}
      height={40}
      style={position}
    />
  );
}
