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

export interface Props {
  currentPositionAtom: PrimitiveAtom<CurrentPosition>;
  clickedSquaresAtom: PrimitiveAtom<Square[]>;
  playableSquaresAtom: PrimitiveAtom<Square[]>;
  checkedKingAtom: Atom<CheckedKing | null>;
}

/**
 * Paints a square's own state: the check, the selection, the last move and the
 * squares a piece can go to. The move-quality mark is not drawn here, because
 * a square's stacking context would keep it beneath the arrows.
 */
export function getSquareRenderer({
  currentPositionAtom,
  clickedSquaresAtom,
  playableSquaresAtom,
  checkedKingAtom,
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

      const isPlayable = useAtomValue(
        useMemo(
          () => atom((get) => get(playableSquaresAtom).includes(square)),
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

      const highlightSquareStyle: CSSProperties | undefined = useMemo(
        () =>
          isClicked
            ? rightClickSquareStyle
            : isFromSquare || isToSquare
              ? previousMoveSquareStyle(moveClassification)
              : undefined,
        [isClicked, isFromSquare, isToSquare, moveClassification]
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
          {isPlayable && <div style={playableSquareStyles} />}
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
