import { Orientation, squareAtPoint } from "@/lib/arrows/geometry";
import type { BoardArrow } from "@/lib/arrows/types";
import type { Square } from "chess.js";
import { MouseEvent, useCallback, useRef, useState } from "react";

// The pens Lichess has: green, red with Shift or Ctrl, blue with Alt or Meta,
// and yellow with both. Each is dark enough to stand out from its white outline.
export const INK_COLORS = {
  green: "#3a9d5d",
  red: "#d9534f",
  blue: "#2a6fdb",
  yellow: "#ad8100",
} as const;

const NO_INK: BoardArrow[] = [];

export const inkColor = (event: {
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}) => {
  const red = event.shiftKey || event.ctrlKey;
  const blue = event.altKey || event.metaKey;
  return red && blue
    ? INK_COLORS.yellow
    : red
      ? INK_COLORS.red
      : blue
        ? INK_COLORS.blue
        : INK_COLORS.green;
};

interface Drag {
  square: Square;
  positionKey: string;
}

/**
 * The user's own arrows, drawn by dragging with the right button. They belong
 * to the position they were drawn on, so engine updates never touch them and
 * they are back when the position is. A left click clears the current ones.
 */
export const useInkArrows = (positionKey: string, orientation: Orientation) => {
  const [byPosition, setByPosition] = useState<Record<string, BoardArrow[]>>(
    {}
  );
  const [draft, setDraft] = useState<{
    positionKey: string;
    arrow: BoardArrow;
  }>();
  const drag = useRef<Drag | undefined>(undefined);

  const squareAt = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      return squareAtPoint(
        ((event.clientX - rect.left) / rect.width) * 8,
        ((event.clientY - rect.top) / rect.height) * 8,
        orientation
      );
    },
    [orientation]
  );

  const onMouseDown = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (event.button !== 2) return;
      const square = squareAt(event);
      drag.current = square ? { square, positionKey } : undefined;
    },
    [squareAt, positionKey]
  );

  const onMouseMove = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const start = drag.current;
      if (!start) return;

      // The button was released outside the board, or the position moved on.
      if (!(event.buttons & 2) || start.positionKey !== positionKey) {
        drag.current = undefined;
        setDraft(undefined);
        return;
      }

      const square = squareAt(event);
      const color = inkColor(event);
      setDraft((current) => {
        if (!square || square === start.square) {
          return undefined;
        }
        const arrow = current?.arrow;
        if (
          arrow &&
          arrow.to === square &&
          arrow.color === color &&
          current.positionKey === positionKey
        ) {
          return current;
        }
        return {
          positionKey,
          arrow: { from: start.square, to: square, kind: "ink", color },
        };
      });
    },
    [squareAt, positionKey]
  );

  const onMouseUp = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (event.button !== 2) return;
      const start = drag.current;
      drag.current = undefined;
      setDraft(undefined);
      if (!start || start.positionKey !== positionKey) return;

      // Releasing on the origin is a plain right click, which marks the square.
      const square = squareAt(event);
      if (!square || square === start.square) return;

      const color = inkColor(event);
      setByPosition((current) => {
        const list = current[positionKey] ?? NO_INK;
        const exists = list.some(
          (arrow) => arrow.from === start.square && arrow.to === square
        );
        const next = exists
          ? list.filter(
              (arrow) => !(arrow.from === start.square && arrow.to === square)
            )
          : [
              ...list,
              { from: start.square, to: square, kind: "ink" as const, color },
            ];
        const updated = { ...current };
        if (next.length) updated[positionKey] = next;
        else delete updated[positionKey];
        return updated;
      });
    },
    [squareAt, positionKey]
  );

  const clearInk = useCallback(
    () =>
      setByPosition((current) => {
        if (!(positionKey in current)) return current;
        const updated = { ...current };
        delete updated[positionKey];
        return updated;
      }),
    [positionKey]
  );

  return {
    ink: byPosition[positionKey] ?? NO_INK,
    draft: draft?.positionKey === positionKey ? draft.arrow : undefined,
    clearInk,
    handlers: { onMouseDown, onMouseMove, onMouseUp },
  };
};
