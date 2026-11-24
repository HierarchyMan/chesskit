import { CurrentPosition } from "@/types/eval";
import { MoveClassification } from "@/types/enums";
import { Atom, PrimitiveAtom, atom, useAtomValue } from "jotai";
import { CSSProperties, forwardRef, memo, useMemo } from "react";
import {
  CustomSquareProps,
  Square,
} from "react-chessboard/dist/chessboard/types";
import { CLASSIFICATION_COLORS } from "@/constants";
import { boardHueAtom } from "./states";
import { areObjectsEqual, isObject } from "@/lib/object";
import { CheckedKing } from "@/lib/chess";
import { BoardCues, HighlightTone } from "./cues";

/** A square the selected piece can move to. */
export interface MoveTarget {
  square: Square;
  /** The move takes an enemy piece standing on the square. */
  capture: boolean;
}

export interface Props {
  currentPositionAtom: PrimitiveAtom<CurrentPosition>;
  clickedSquaresAtom: PrimitiveAtom<Square[]>;
  playableSquaresAtom: PrimitiveAtom<MoveTarget[]>;
  checkedKingAtom: Atom<CheckedKing | null>;
  threatenedSquaresAtom: Atom<Square[]>;
  /** The last move and hint a page asked for, used where the position carries none. */
  cuesAtom: Atom<BoardCues>;
}

/**
 * Paints a square's own state: the check, the selection, the last move, the
 * squares a piece can go to, and the pieces the other side can take. The
 * move-quality mark is not drawn here, because a square's stacking context
 * would keep it beneath the arrows.
 */
export function getSquareRenderer({
  currentPositionAtom,
  clickedSquaresAtom,
  playableSquaresAtom,
  checkedKingAtom,
  threatenedSquaresAtom,
  cuesAtom,
}: Props) {
  const squareRenderer = memo(
    forwardRef<HTMLDivElement, CustomSquareProps>((props, ref) => {
      const { children, square, style } = props;
      const boardHue = useAtomValue(boardHueAtom);

      const checkedKing = useAtomValue(
        useMemo(
          () =>
            atom((get) => {
              const king = get(checkedKingAtom);
              return king?.square === square ? king : null;
            }),
          [square]
        )
      );
      const isCheckedKing = !!checkedKing;
      const isMatedKing = !!checkedKing?.mated;

      const isClicked = useAtomValue(
        useMemo(
          () => atom((get) => get(clickedSquaresAtom).includes(square)),
          [square]
        )
      );

      const moveTarget = useAtomValue(
        useMemo(
          () =>
            atom((get) =>
              get(playableSquaresAtom).find(
                (target) => target.square === square
              )
            ),
          [square]
        )
      );
      const isPlayable = !!moveTarget;
      const isCapture = !!moveTarget?.capture;

      const isThreatened = useAtomValue(
        useMemo(
          () => atom((get) => get(threatenedSquaresAtom).includes(square)),
          [square]
        )
      );

      const isFromSquare = useAtomValue(
        useMemo(
          () =>
            atom((get) => get(currentPositionAtom).lastMove?.from === square),
          [square]
        )
      );

      const isToSquare = useAtomValue(
        useMemo(
          () => atom((get) => get(currentPositionAtom).lastMove?.to === square),
          [square]
        )
      );

      const moveClassification = useAtomValue(
        useMemo(
          () =>
            atom((get) => {
              const evalData = get(currentPositionAtom).eval;

              const isNeeded = isFromSquare || isToSquare;
              if (!isNeeded) return undefined;

              return evalData?.moveClassification;
            }),
          [isFromSquare, isToSquare]
        )
      );

      // A graded position colours its last move by the grade; any other
      // position falls back to the move the page or the game itself names.
      const cuedMove = useAtomValue(
        useMemo(
          () =>
            atom((get) => {
              const move = get(cuesAtom).lastMove;
              if (!move || (move.from !== square && move.to !== square)) {
                return undefined;
              }
              return move.tone ?? "neutral";
            }),
          [square]
        )
      );

      const isHinted = useAtomValue(
        useMemo(() => atom((get) => get(cuesAtom).hint === square), [square])
      );

      const coachHighlight = useAtomValue(
        useMemo(
          () =>
            atom((get) =>
              get(cuesAtom).highlights?.find((h) => h.square === square)
            ),
          [square]
        )
      );

      const squareEffect = useAtomValue(
        useMemo(
          () =>
            atom((get) => {
              const eff = get(cuesAtom).effect;
              return eff?.square === square ? eff : undefined;
            }),
          [square]
        )
      );

      const highlightSquareStyle: CSSProperties | undefined = useMemo(
        () =>
          isClicked
            ? rightClickSquareStyle
            : isFromSquare || isToSquare
              ? previousMoveSquareStyle(moveClassification)
              : cuedMove === "bad"
                ? wrongMoveSquareStyle
                : cuedMove
                  ? previousMoveSquareStyle()
                  : undefined,
        [isClicked, isFromSquare, isToSquare, moveClassification, cuedMove]
      );

      const effectClassName =
        squareEffect?.kind === "shake_king"
          ? "ck-effect-shake"
          : squareEffect?.kind === "spin_king"
            ? "ck-effect-spin"
            : undefined;

      return (
        <div
          ref={ref}
          className={effectClassName}
          style={{
            ...style,
            position: "relative",
            filter: boardHue ? `hue-rotate(-${boardHue}deg)` : undefined,
            // The square's marks and notation are chrome, not text to copy.
            userSelect: "none",
          }}
        >
          {isCheckedKing && <div style={checkedKingStyle} />}
          {children}
          {isMatedKing && <div style={checkmateMarkStyle}>#</div>}
          {highlightSquareStyle && <div style={highlightSquareStyle} />}
          {coachHighlight && (
            <div
              className={
                coachHighlight.pulse ? "ck-highlight-pulse" : undefined
              }
              style={coachHighlightStyle(coachHighlight.tone)}
            />
          )}
          {isHinted && <div style={hintSquareStyle} />}
          {isPlayable && (
            <div
              style={isCapture ? captureSquareStyles : playableSquareStyles}
            />
          )}
          {isThreatened && <div style={hangingSquareStyle} />}
          {squareEffect &&
            (squareEffect.kind === "point_earned" ||
              squareEffect.kind === "progress_made") && (
              <div
                key={squareEffect.key ?? 0}
                className="ck-effect-float"
                style={floatingBadgeStyle(squareEffect.kind)}
              >
                {squareEffect.kind === "point_earned" ? "+1" : "★"}
              </div>
            )}
        </div>
      );
    }),
    (prevProps, nextProps) => {
      if (prevProps === nextProps) return true;
      if (prevProps.square !== nextProps.square) return false;
      if (prevProps.squareColor !== nextProps.squareColor) return false;
      if (prevProps.key !== nextProps.key) return false;
      if (prevProps.ref !== nextProps.ref) return false;
      if (!areObjectsEqual(prevProps.style, nextProps.style)) return false;
      if (!areChildrensEqual(prevProps.children, nextProps.children)) {
        return false;
      }
      return true;
    }
  );

  squareRenderer.displayName = "SquareRenderer";

  return squareRenderer;
}

const rightClickSquareStyle: CSSProperties = {
  position: "absolute",
  width: "100%",
  height: "100%",
  backgroundColor: "#eb6150",
  opacity: "0.8",
};

const wrongMoveSquareStyle: CSSProperties = {
  position: "absolute",
  width: "100%",
  height: "100%",
  backgroundColor: "#e0453a",
  opacity: 0.6,
};

/** A ring around the piece a hint points at, with a faint wash inside it. */
const hintSquareStyle: CSSProperties = {
  position: "absolute",
  width: "100%",
  height: "100%",
  boxSizing: "border-box",
  border: "4px solid rgba(60, 140, 255, 0.95)",
  backgroundColor: "rgba(60, 140, 255, 0.22)",
  pointerEvents: "none",
};

const COACH_HIGHLIGHT_PALETTE: Record<
  HighlightTone,
  { bg: string; ring: string }
> = {
  danger: {
    bg: "rgba(239, 68, 68, 0.30)",
    ring: "inset 0 0 0 3px rgba(239, 68, 68, 0.92)",
  },
  bright: {
    bg: "rgba(245, 184, 46, 0.30)",
    ring: "inset 0 0 0 3px rgba(245, 184, 46, 0.92)",
  },
  success: {
    bg: "rgba(34, 197, 94, 0.28)",
    ring: "inset 0 0 0 3px rgba(34, 197, 94, 0.92)",
  },
  mentioned: {
    bg: "rgba(99, 130, 246, 0.26)",
    ring: "inset 0 0 0 3px rgba(99, 130, 246, 0.9)",
  },
  selected: {
    bg: "rgba(56, 189, 248, 0.28)",
    ring: "inset 0 0 0 3px rgba(56, 189, 248, 0.92)",
  },
};

const coachHighlightStyle = (tone: HighlightTone): CSSProperties => ({
  position: "absolute",
  inset: 0,
  backgroundColor: COACH_HIGHLIGHT_PALETTE[tone].bg,
  boxShadow: COACH_HIGHLIGHT_PALETTE[tone].ring,
  pointerEvents: "none",
  zIndex: 2,
});

const floatingBadgeStyle = (
  kind: "point_earned" | "progress_made"
): CSSProperties => ({
  position: "absolute",
  top: "14%",
  right: "10%",
  padding: "2px 6px",
  borderRadius: "999px",
  backgroundColor: kind === "point_earned" ? "#22c55e" : "#f59e0b",
  color: "#ffffff",
  fontSize: "calc(var(--board-size, 400px) * 0.032)",
  fontWeight: 800,
  lineHeight: 1.1,
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
  pointerEvents: "none",
  zIndex: 8,
});

const checkedKingStyle: CSSProperties = {
  position: "absolute",
  width: "100%",
  height: "100%",
  background:
    "radial-gradient(ellipse at center, rgba(255,0,0,1) 0%, rgba(231,0,0,1) 25%, rgba(169,0,0,0) 89%, rgba(158,0,0,0) 100%)",
};

/** The checkmated king's mark: a red hash in the square's top right corner. */
const checkmateMarkStyle: CSSProperties = {
  position: "absolute",
  // Centred at 90% of the way to the square's top right corner.
  top: "10%",
  left: "90%",
  transform: "translate(-50%, -50%)",
  width: "38%",
  height: "38%",
  borderRadius: "50%",
  backgroundColor: "#e53935",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  lineHeight: 1,
  // The hash is about half the circle's height, so it stays inside the circle.
  fontSize: "calc(var(--board-size, 400px) * 0.035)",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.5)",
  pointerEvents: "none",
  // Above the piece, which the square paints beneath this mark.
  zIndex: 5,
};

const playableSquareStyles: CSSProperties = {
  position: "absolute",
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0,0,0,.14)",
  padding: "35%",
  backgroundClip: "content-box",
  borderRadius: "50%",
  boxSizing: "border-box",
};

/**
 * A square whose piece can be taken is ringed rather than dotted: a dot would
 * sit on the piece's own body and disappear behind it. The corners outside
 * the ring are filled too, so the open circle at the centre frames the piece.
 */
const captureSquareStyles: CSSProperties = {
  position: "absolute",
  width: "100%",
  height: "100%",
  // Radial stops are percentages of the half side, so 100% is the edge midpoint.
  background:
    "radial-gradient(circle closest-side, transparent 86%, rgba(0,0,0,.14) 86%)",
};

/**
 * A piece of the viewer's that the other side can win. A dashed red frame, so
 * it can never be read as a capture target (which is a ring) or a legal move
 * (which is a dot).
 */
const hangingSquareStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  boxSizing: "border-box",
  border: "3px dashed rgba(220, 38, 38, 0.9)",
  borderRadius: 4,
  backgroundColor: "rgba(220, 38, 38, 0.1)",
  pointerEvents: "none",
};

const previousMoveSquareStyle = (
  moveClassification?: MoveClassification
): CSSProperties => ({
  position: "absolute",
  width: "100%",
  height: "100%",
  backgroundColor: moveClassification
    ? CLASSIFICATION_COLORS[moveClassification]
    : "#fad541",
  opacity: 0.5,
});

const areChildrensEqual = (
  prevChildren: React.ReactNode,
  nextChildren: React.ReactNode
): boolean => {
  if (prevChildren === nextChildren) return true;
  if (!Array.isArray(prevChildren) || !Array.isArray(nextChildren)) {
    return false;
  }
  if (prevChildren.length !== nextChildren.length) return false;

  for (let i = 0; i < prevChildren.length; i++) {
    const prevChild: unknown = prevChildren[i];
    const nextChild: unknown = nextChildren[i];

    if (prevChild === nextChild) continue;

    if (!isElementWithProps(prevChild) || !isElementWithProps(nextChild)) {
      return false;
    }

    for (const key of ["row", "col", "piece", "square"]) {
      if (prevChild.props[key] !== nextChild.props[key]) {
        return false;
      }
    }
  }

  return true;
};

const isElementWithProps = (
  node: unknown
): node is React.ReactElement<Record<string, unknown>> => {
  return isObject(node) && "props" in node && isObject(node.props);
};
