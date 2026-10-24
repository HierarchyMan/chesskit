import { Grid2 as Grid } from "@mui/material";
import { Chessboard } from "react-chessboard";
import { Atom, PrimitiveAtom, atom, useAtomValue, useSetAtom } from "jotai";
import {
  CustomSquareRenderer,
  PromotionPieceOption,
  Square,
} from "react-chessboard/dist/chessboard/types";
import { useChessActions } from "@/hooks/useChessActions";
import {
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Color } from "@/types/enums";
import { Chess } from "chess.js";
import { getSquareRenderer } from "./squareRenderer";
import { CurrentPosition } from "@/types/eval";
import EvaluationBar from "./evaluationBar";
import { Player } from "@/types/game";
import PlayerHeader from "./playerHeader";
import { useBoardAppearance } from "./appearance";
import ArrowLayer, { useMaskSettling } from "./arrowLayer";
import { useInkArrows } from "./useInkArrows";
import { BoardArrow } from "@/lib/arrows/types";
import { chessPathKey } from "@/lib/chessHistory";
import { getCheckedKing } from "@/lib/chess";
import QualityIcon, { useQualityMark } from "./moveQuality";

const noPositionAtom = atom<CurrentPosition>({});
const NO_ARROWS: readonly BoardArrow[] = [];

/** How long a move takes to slide, in milliseconds. */
export const MOVE_ANIMATION_MS = 200;
/** Masks wait this much longer than a slide, so they are cut only on settled pieces. */
const MASK_SETTLE_MS = MOVE_ANIMATION_MS + 30;

export interface Props {
  id: string;
  canPlay?: Color | boolean;
  gameAtom: PrimitiveAtom<Chess>;
  boardSize?: number;
  whitePlayer: Player;
  blackPlayer: Player;
  boardOrientation?: Color;
  currentPositionAtom?: PrimitiveAtom<CurrentPosition>;
  showPlayerMoveIconAtom?: PrimitiveAtom<boolean>;
  showEvaluationBar?: boolean;
  resetEvaluationWhenPending?: boolean;
  arrows?: readonly BoardArrow[];
  /** Controls that sit above the board, such as a compact overlay entry. */
  header?: ReactNode;
  /** Controls that belong with the board, shown beneath it. */
  footer?: ReactNode;
  clocksAtom?: Atom<{ w: number; b: number } | null>;
}

/** The board's width in pixels, measured as it changes. */
const useBoardPixels = (ref: RefObject<HTMLDivElement | null>) => {
  const [pixels, setPixels] = useState<number>();
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setPixels(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return pixels;
};

export default function Board({
  id: boardId,
  canPlay,
  gameAtom,
  boardSize,
  whitePlayer,
  blackPlayer,
  boardOrientation = Color.White,
  currentPositionAtom = noPositionAtom,
  showPlayerMoveIconAtom,
  showEvaluationBar = false,
  resetEvaluationWhenPending = false,
  arrows,
  header,
  footer,
  clocksAtom,
}: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const pixels = useBoardPixels(boardRef);
  const game = useAtomValue(gameAtom);
  const qualityMark = useQualityMark(
    currentPositionAtom,
    showPlayerMoveIconAtom
  );
  const { playMove } = useChessActions(gameAtom);
  const clickedSquaresAtom = useMemo(() => atom<Square[]>([]), []);
  const setClickedSquares = useSetAtom(clickedSquaresAtom);
  const playableSquaresAtom = useMemo(() => atom<Square[]>([]), []);
  const setPlayableSquares = useSetAtom(playableSquaresAtom);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const [moveClickFrom, setMoveClickFrom] = useState<Square | null>(null);
  const [moveClickTo, setMoveClickTo] = useState<Square | null>(null);
  const appearance = useBoardAppearance();
  const whiteClockAtom = useMemo(
    () => (clocksAtom ? atom((get) => get(clocksAtom)?.w) : undefined),
    [clocksAtom]
  );
  const blackClockAtom = useMemo(
    () => (clocksAtom ? atom((get) => get(clocksAtom)?.b) : undefined),
    [clocksAtom]
  );

  const gameFen = game.fen();
  const turn = game.turn();
  const orientation = boardOrientation === Color.White ? "white" : "black";
  const positionKey = useMemo(() => chessPathKey(game), [game]);
  const { ink, draft, clearInk, handlers } = useInkArrows(
    positionKey,
    orientation
  );

  // A piece that is held is not where its square says, so arrows are not cut
  // around it while a drag is under way.
  const [dragging, setDragging] = useState(false);
  const settled = useMaskSettling(gameFen, MASK_SETTLE_MS);

  useEffect(() => {
    setClickedSquares([]);
    setMoveClickFrom(null);
    setMoveClickTo(null);
    setShowPromotionDialog(false);
    setPlayableSquares([]);
  }, [gameFen, setClickedSquares, setPlayableSquares]);

  const isPiecePlayable = useCallback(
    ({ piece }: { piece: string }): boolean => {
      if (game.isGameOver() || !canPlay) return false;
      if (canPlay === true || canPlay === piece[0]) return true;
      return false;
    },
    [canPlay, game]
  );

  const onPieceDrop = useCallback(
    (source: Square, target: Square, piece: string): boolean => {
      if (!isPiecePlayable({ piece })) return false;

      const result = playMove(
        {
          from: source,
          to: target,
          promotion: piece[1]?.toLowerCase() ?? "q",
        },
        game
      );

      return !!result;
    },
    [isPiecePlayable, playMove, game]
  );

  const resetMoveClick = useCallback(
    (square?: Square | null) => {
      setMoveClickFrom(square ?? null);
      setMoveClickTo(null);
      setShowPromotionDialog(false);
      if (square) {
        const moves = game.moves({ square, verbose: true });
        setPlayableSquares(moves.map((m) => m.to));
      } else {
        setPlayableSquares([]);
      }
    },
    [setMoveClickFrom, setMoveClickTo, setPlayableSquares, game]
  );

  const handleSquareLeftClick = useCallback(
    (square: Square, piece?: string) => {
      setClickedSquares([]);
      clearInk();

      if (!moveClickFrom) {
        if (piece && !isPiecePlayable({ piece })) return;
        resetMoveClick(square);
        return;
      }

      const validMoves = game.moves({ square: moveClickFrom, verbose: true });
      const move = validMoves.find((m) => m.to === square);

      if (!move) {
        resetMoveClick(square);
        return;
      }

      setMoveClickTo(square);

      if (
        move.piece === "p" &&
        ((move.color === "w" && square[1] === "8") ||
          (move.color === "b" && square[1] === "1"))
      ) {
        setShowPromotionDialog(true);
        return;
      }

      const result = playMove(
        {
          from: moveClickFrom,
          to: square,
        },
        game
      );

      resetMoveClick(result ? undefined : square);
    },
    [
      game,
      isPiecePlayable,
      moveClickFrom,
      playMove,
      resetMoveClick,
      setClickedSquares,
      clearInk,
    ]
  );

  const handleSquareRightClick = useCallback(
    (square: Square) => {
      setClickedSquares((prev) =>
        prev.includes(square)
          ? prev.filter((s) => s !== square)
          : [...prev, square]
      );
    },
    [setClickedSquares]
  );

  const handlePieceDragBegin = useCallback(
    (_: string, square: Square) => {
      setDragging(true);
      resetMoveClick(square);
    },
    [resetMoveClick]
  );

  const handlePieceDragEnd = useCallback(() => {
    setDragging(false);
    resetMoveClick();
  }, [resetMoveClick]);

  const onPromotionPieceSelect = useCallback(
    (piece?: PromotionPieceOption, from?: Square, to?: Square) => {
      if (!piece) return false;
      const promotionPiece = piece[1]?.toLowerCase() ?? "q";

      if (moveClickFrom && moveClickTo) {
        const result = playMove(
          {
            from: moveClickFrom,
            to: moveClickTo,
            promotion: promotionPiece,
          },
          game
        );
        resetMoveClick();
        return !!result;
      }

      if (from && to) {
        const result = playMove(
          {
            from,
            to,
            promotion: promotionPiece,
          },
          game
        );
        resetMoveClick();
        return !!result;
      }

      resetMoveClick(moveClickFrom);
      return false;
    },
    [moveClickFrom, moveClickTo, playMove, resetMoveClick, game]
  );

  const checkedKingAtom = useMemo(
    () => atom((get) => getCheckedKing(get(gameAtom))),
    [gameAtom]
  );

  const SquareRenderer: CustomSquareRenderer = useMemo(() => {
    return getSquareRenderer({
      currentPositionAtom: currentPositionAtom,
      clickedSquaresAtom,
      playableSquaresAtom,
      checkedKingAtom,
    });
  }, [
    currentPositionAtom,
    clickedSquaresAtom,
    playableSquaresAtom,
    checkedKingAtom,
  ]);

  return (
    <Grid
      container
      justifyContent="center"
      alignItems="center"
      wrap="nowrap"
      width={boardSize}
      sx={{ "--board-size": `${boardSize || 400}px`, maxWidth: "100%" }}
    >
      {showEvaluationBar && (
        <EvaluationBar
          height={boardRef?.current?.offsetHeight || boardSize || 400}
          boardOrientation={boardOrientation}
          currentPositionAtom={currentPositionAtom}
          resetWhenPending={resetEvaluationWhenPending}
          fen={gameFen}
        />
      )}

      <Grid
        container
        rowGap={1.5}
        justifyContent="center"
        alignItems="center"
        paddingLeft={{ xs: 0.5, sm: showEvaluationBar ? 2 : 0 }}
        size="grow"
      >
        {header}

        <PlayerHeader
          color={boardOrientation === Color.White ? Color.Black : Color.White}
          gameAtom={gameAtom}
          player={boardOrientation === Color.White ? blackPlayer : whitePlayer}
          clockMsAtom={
            boardOrientation === Color.White ? blackClockAtom : whiteClockAtom
          }
        />

        <Grid
          container
          justifyContent="center"
          alignItems="center"
          ref={boardRef}
          sx={{ aspectRatio: "1 / 1", width: "100%", position: "relative" }}
          size={12}
          {...handlers}
        >
          <Chessboard
            id={`${boardId}-${canPlay}`}
            position={gameFen}
            onPieceDrop={onPieceDrop}
            boardOrientation={
              boardOrientation === Color.White ? "white" : "black"
            }
            customBoardStyle={appearance.customBoardStyle}
            customDarkSquareStyle={appearance.customDarkSquareStyle}
            customLightSquareStyle={appearance.customLightSquareStyle}
            showBoardNotation={appearance.showBoardNotation}
            areArrowsAllowed={false}
            isDraggablePiece={isPiecePlayable}
            customSquare={SquareRenderer}
            onSquareClick={handleSquareLeftClick}
            onSquareRightClick={handleSquareRightClick}
            onPieceDragBegin={handlePieceDragBegin}
            onPieceDragEnd={handlePieceDragEnd}
            onPromotionPieceSelect={onPromotionPieceSelect}
            showPromotionDialog={showPromotionDialog}
            promotionToSquare={moveClickTo}
            animationDuration={MOVE_ANIMATION_MS}
            customPieces={appearance.customPieces}
          />
          <ArrowLayer
            arrows={arrows ?? NO_ARROWS}
            ink={ink}
            draft={draft}
            orientation={orientation}
            turn={turn}
            fen={gameFen}
            size={pixels}
            masking={settled && !dragging}
            qualityMarkedSquare={qualityMark?.square}
          />
          {qualityMark && (
            <QualityIcon mark={qualityMark} orientation={orientation} />
          )}
        </Grid>

        <PlayerHeader
          color={boardOrientation}
          gameAtom={gameAtom}
          player={boardOrientation === Color.White ? whitePlayer : blackPlayer}
          clockMsAtom={
            boardOrientation === Color.White ? whiteClockAtom : blackClockAtom
          }
        />

        {footer}
      </Grid>
    </Grid>
  );
}
