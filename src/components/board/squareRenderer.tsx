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
import { BoardCues } from "./cues";

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

      return (
        <div
          ref={ref}
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
          {isHinted && <div style={hintSquareStyle} />}
          {isPlayable && (
            <div
              style={isCapture ? captureSquareStyles : playableSquareStyles}
            />
          )}
          {isThreatened && <div style={captureSquareStyles} />}
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
