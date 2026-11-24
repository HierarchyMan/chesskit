import { Box, Grid2 as Grid } from "@mui/material";
import { useBoardStage } from "@/components/boardWorkspace";
import Chessboard from "./motionChessboard";
import { Atom, PrimitiveAtom, atom, useAtomValue, useSetAtom } from "jotai";
import {
  CustomSquareRenderer,
  PromotionPieceOption,
  Square,
} from "react-chessboard/dist/chessboard/types";
import { useChessActions } from "@/hooks/useChessActions";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import {
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Color } from "@/types/enums";
import { Chess } from "chess.js";
import { MoveTarget, getSquareRenderer } from "./squareRenderer";
import { CurrentPosition } from "@/types/eval";
import EvaluationBar from "./evaluationBar";
import { Player } from "@/types/game";
import PlayerHeader from "./playerHeader";
import { useBoardAppearance } from "./appearance";
import { autoQueenAtom } from "./states";
import ArrowLayer from "./arrowLayer";
import { useInkArrows } from "./useInkArrows";
import { BoardArrow } from "@/lib/arrows/types";
import { chessPathKey, isChessPrefix } from "@/lib/chessHistory";
import { getCheckedKing, getHangingPieces } from "@/lib/chess";
import QualityIcon, { useQualityMark } from "./moveQuality";
import DrawBadges from "./drawBadges";
import { getBoardDraw } from "@/lib/boardDraw";
import { GameEnd } from "@/lib/gameResult";
import { PIECE_SLIDE_MS } from "@/lib/pieceMotion";
import {
  BoardCues,
  BoardEffect,
  LastMoveCue,
  SquareHighlight,
  VerdictCue,
} from "./cues";
import VerdictMark from "./verdictMark";

const noPositionAtom = atom<CurrentPosition>({});
const NO_ARROWS: readonly BoardArrow[] = [];

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
  /** Changes when the board is attached to a different game or session. */
  gameIdentity?: number | string;
  arrows?: readonly BoardArrow[];
  /** Controls that sit above the board, such as a compact overlay entry. */
  header?: ReactNode;
  /** Controls that belong with the board, shown beneath it. */
  footer?: ReactNode;
  clocksAtom?: Atom<{ w: number; b: number } | null>;
  previewFen?: string;
  gameEnd?: GameEnd | null;
  recordedDraw?: boolean;
  /**
   * The move to mark as the last one. By default it is the game's own last
   * move, so every board shows where the previous move went; a page sets it
   * for a move the game does not hold, or to tint it.
   */
  lastMove?: LastMoveCue;
  /** A square to ring, such as the piece a hint points at. */
  hintSquare?: Square;
  /** Multi-square semantic highlights (danger, bright, success, mentioned, selected). */
  highlights?: readonly SquareHighlight[];
  /** Transient square animation (king shake/spin, progress badge). */
  effect?: BoardEffect;
  /** Visual demonstration frame shown while the coach plays out a preview cascade. */
  demonstrationFrame?: boolean;
  /** A tick or cross on the square the user's move went to. */
  verdict?: VerdictCue;
  /** Names the position shown; a change means a different position, not a move. */
  motionKey?: string;
  /**
   * Let the player queue one move while the opponent is thinking (a premove).
   * It plays the moment the opponent replies, if it is still legal, and is
   * dropped if anything else changes the game first.
   */
  premoves?: boolean;
  /**
   * Frame the viewer's own pieces the other side can win, on the other side's
   * turn. Off by default: it is an aid, so a mode without aids leaves it off.
   */
  threatMarks?: boolean;
  /** Called with +1 or -1 as the wheel turns over the board, to step through moves. */
  onWheelStep?: (direction: 1 | -1) => void;
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
  boardSize: suppliedBoardSize,
  whitePlayer,
  blackPlayer,
  boardOrientation = Color.White,
  currentPositionAtom = noPositionAtom,
  showPlayerMoveIconAtom,
  showEvaluationBar = false,
  gameIdentity,
  arrows,
  header,
  footer,
  clocksAtom,
  previewFen,
  gameEnd,
  recordedDraw,
  lastMove,
  hintSquare,
  highlights,
  effect,
  demonstrationFrame = false,
  verdict,
  motionKey,
  premoves = false,
  threatMarks = false,
  onWheelStep,
}: Props) {
  const stage = useBoardStage();
  const boardSize = stage?.width ?? suppliedBoardSize;
  const rootRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [barTop, setBarTop] = useState(0);
  const reportChrome = stage?.reportChrome;
  useLayoutEffect(() => {
    if (!stackRef.current || !boardRef.current) return;
    const measure = () => {
      const board = boardRef.current?.getBoundingClientRect();
      const stack = stackRef.current?.getBoundingClientRect();
      const root = rootRef.current?.getBoundingClientRect();
      if (board && stack && root) {
        reportChrome?.(stack.height - board.height, root.width - board.width);
        setBarTop(board.top - root.top);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stackRef.current);
    observer.observe(boardRef.current);
    return () => observer.disconnect();
  }, [reportChrome]);
  const pixels = useBoardPixels(boardRef);
  const game = useAtomValue(gameAtom);
  const qualityMark = useQualityMark(
    currentPositionAtom,
    showPlayerMoveIconAtom
  );
  const { playMove } = useChessActions(gameAtom);
  const autoQueen = useAtomValue(autoQueenAtom);
  const [queuedMove, setQueuedMove] = useState<{
    from: Square;
    to: Square;
    game: Chess;
    identity: typeof gameIdentity;
    color: Color;
  } | null>(null);
  const clickedSquaresAtom = useMemo(() => atom<Square[]>([]), []);
  const setClickedSquares = useSetAtom(clickedSquaresAtom);
  const playableSquaresAtom = useMemo(() => atom<MoveTarget[]>([]), []);
  const setPlayableSquares = useSetAtom(playableSquaresAtom);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const pendingPromotion = useRef(false);
  const isDragging = useRef(false);
  const dragCancelled = useRef(false);
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

  const gameFen = previewFen ?? game.fen();
  const gameLastMove = useMemo<LastMoveCue | undefined>(() => {
    if (previewFen) return undefined;
    const move = game.history({ verbose: true }).at(-1);
    return move ? { from: move.from, to: move.to } : undefined;
  }, [game, previewFen]);
  const shownLastMove = lastMove ?? gameLastMove;
  const cuesAtom = useMemo(() => atom<BoardCues>({}), []);
  const setCues = useSetAtom(cuesAtom);
  const lastFrom = shownLastMove?.from;
  const lastTo = shownLastMove?.to;
  const lastTone = shownLastMove?.tone;
  useLayoutEffect(() => {
    setCues({
      lastMove:
        lastFrom && lastTo
          ? { from: lastFrom, to: lastTo, tone: lastTone }
          : undefined,
      hint: hintSquare,
      highlights,
      effect,
    });
  }, [lastFrom, lastTo, lastTone, hintSquare, highlights, effect, setCues]);
  const drawResult = useMemo(
    () =>
      getBoardDraw(
        previewFen ?? game,
        previewFen ? null : gameEnd,
        !previewFen && recordedDraw
      ),
    [game, previewFen, gameEnd, recordedDraw]
  );
  const turn = game.turn();
  const orientation = boardOrientation === Color.White ? "white" : "black";
  const positionKey = useMemo(
    () => (previewFen ? `preview:${previewFen}` : chessPathKey(game)),
    [game, previewFen]
  );
  const { ink, draft, clearInk, handlers } = useInkArrows(
    positionKey,
    orientation
  );

  // A piece that is held is not where its square says, so arrows are not cut
  // around it while a drag is under way.

  useEffect(() => {
    pendingPromotion.current = false;
    setClickedSquares([]);
    setMoveClickFrom(null);
    setMoveClickTo(null);
    setShowPromotionDialog(false);
    setPlayableSquares([]);
  }, [gameFen, setClickedSquares, setPlayableSquares]);

  const allowPremove =
    premoves &&
    !previewFen &&
    (canPlay === Color.White || canPlay === Color.Black);
  const isPiecePlayable = useCallback(
    ({ piece }: { piece: string }): boolean =>
      !previewFen &&
      !game.isGameOver() &&
      (canPlay === true || canPlay === piece[0]) &&
      (turn === piece[0] || allowPremove),
    [allowPremove, canPlay, game, previewFen, turn]
  );

  useEffect(() => {
    if (!queuedMove) return;
    if (
      !allowPremove ||
      queuedMove.identity !== gameIdentity ||
      queuedMove.color !== canPlay ||
      game.isGameOver()
    ) {
      setQueuedMove(null);
      return;
    }
    if (game === queuedMove.game) return;
    setQueuedMove(null);

    const history = game.history({ verbose: true });
    if (
      turn !== canPlay ||
      history.length !== queuedMove.game.history().length + 1 ||
      !isChessPrefix(queuedMove.game, game)
    )
      return;

    const legal = game
      .moves({ square: queuedMove.from, verbose: true })
      .find(
        (move) =>
          move.to === queuedMove.to &&
          (!move.promotion || (autoQueen && move.promotion === "q"))
      );
    if (legal)
      playMove(
        { from: legal.from, to: legal.to, promotion: legal.promotion },
        game
      );
  }, [
    allowPremove,
    autoQueen,
    canPlay,
    game,
    gameIdentity,
    playMove,
    queuedMove,
    turn,
  ]);

  const onPieceDrop = useCallback(
    (source: Square, target: Square, piece: string): boolean => {
      if (dragCancelled.current || !isPiecePlayable({ piece })) return false;
      if (turn !== piece[0]) {
        if (
          source !== target &&
          (canPlay === Color.White || canPlay === Color.Black)
        ) {
          setQueuedMove({
            from: source,
            to: target,
            game,
            identity: gameIdentity,
            color: canPlay,
          });
        }
        return false;
      }

      const promotion = game
        .moves({ square: source, verbose: true })
        .find((move) => move.to === target && move.promotion === "q");
      if (promotion && !autoQueen) {
        pendingPromotion.current = true;
        setMoveClickFrom(source);
        setMoveClickTo(target);
        setShowPromotionDialog(true);
        return false;
      }
      const result = playMove(
        {
          from: source,
          to: target,
          promotion: promotion ? "q" : undefined,
        },
        game
      );

      return !!result;
    },
    [autoQueen, canPlay, game, gameIdentity, isPiecePlayable, playMove, turn]
  );

  const resetMoveClick = useCallback(
    (square?: Square | null) => {
      pendingPromotion.current = false;
      setMoveClickFrom(square ?? null);
      setMoveClickTo(null);
      setShowPromotionDialog(false);
      if (square) {
        const moves = game.moves({ square, verbose: true });
        setPlayableSquares(
          moves.map((m) => ({
            square: m.to,
            // En passant captures a pawn that is not on the target square.
            capture: m.isCapture() && !m.isEnPassant(),
          }))
        );
      } else {
        setPlayableSquares([]);
      }
    },
    [setMoveClickFrom, setMoveClickTo, setPlayableSquares, game]
  );

  const cancelBoardInput = () => {
    if (isDragging.current) dragCancelled.current = true;
    resetMoveClick();
    setQueuedMove(null);
  };
  useKeyboardShortcut(
    "Escape",
    cancelBoardInput,
    !!moveClickFrom || !!queuedMove || showPromotionDialog
  );

  useEffect(() => {
    const board = boardRef.current;
    if (!board || !onWheelStep) return;
    let lastStep = 0;
    let distance = 0;
    let lastWheel = 0;
    const handleWheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        !event.deltaY ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      )
        return;
      event.preventDefault();
      const now = performance.now();
      if (
        now - lastWheel > 150 ||
        Math.sign(distance) !== Math.sign(event.deltaY)
      )
        distance = 0;
      lastWheel = now;
      distance += event.deltaY * (event.deltaMode ? 24 : 1);
      if (Math.abs(distance) < 24 || now - lastStep < 110) return;
      lastStep = now;
      onWheelStep(distance > 0 ? 1 : -1);
      distance = 0;
    };
    board.addEventListener("wheel", handleWheel, { passive: false });
    return () => board.removeEventListener("wheel", handleWheel);
  }, [onWheelStep]);

  const handleSquareLeftClick = useCallback(
    (square: Square, piece?: string) => {
      setClickedSquares([]);
      clearInk();

      if (showPromotionDialog) return;
      if (moveClickFrom === square) {
        resetMoveClick();
        return;
      }

      const canSelect = !!piece && isPiecePlayable({ piece });
      if (!moveClickFrom) {
        if (canSelect) resetMoveClick(square);
        return;
      }

      const selected = game.get(moveClickFrom);
      if (
        selected &&
        selected.color !== turn &&
        allowPremove &&
        (canPlay === Color.White || canPlay === Color.Black)
      ) {
        if (canSelect) resetMoveClick(square);
        else {
          setQueuedMove({
            from: moveClickFrom,
            to: square,
            game,
            identity: gameIdentity,
            color: canPlay,
          });
          resetMoveClick();
        }
        return;
      }

      const validMoves = game.moves({ square: moveClickFrom, verbose: true });
      const move = validMoves.find((m) => m.to === square);

      if (!move) {
        resetMoveClick(canSelect ? square : null);
        return;
      }

      setMoveClickTo(square);

      if (move.promotion && !autoQueen) {
        setShowPromotionDialog(true);
        return;
      }

      const result = playMove(
        {
          from: moveClickFrom,
          to: square,
          promotion: move.promotion ? "q" : undefined,
        },
        game
      );

      resetMoveClick(result || !canSelect ? undefined : square);
    },
    [
      allowPremove,
      autoQueen,
      canPlay,
      clearInk,
      game,
      gameIdentity,
      isPiecePlayable,
      moveClickFrom,
      playMove,
      resetMoveClick,
      setClickedSquares,
      showPromotionDialog,
      turn,
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
      isDragging.current = true;
      dragCancelled.current = false;
      resetMoveClick(square);
    },
    [resetMoveClick]
  );

  const handlePieceDragEnd = useCallback(() => {
    isDragging.current = false;
    if (!pendingPromotion.current) resetMoveClick();
  }, [resetMoveClick]);

  const onPromotionPieceSelect = useCallback(
    (piece?: PromotionPieceOption, from?: Square, to?: Square) => {
      if (!piece) {
        resetMoveClick();
        return false;
      }
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

  const threatenedSquaresAtom = useMemo(
    () =>
      atom((get) => {
        // Only a side the viewer plays can be threatened, and only while the
        // other side is to move: on the viewer's own turn they can act first.
        if (
          !threatMarks ||
          previewFen ||
          (canPlay !== Color.White && canPlay !== Color.Black)
        )
          return [];
        const game = get(gameAtom);
        if (game.turn() === canPlay) return [];
        return getHangingPieces(game, canPlay);
      }),
    [gameAtom, canPlay, previewFen, threatMarks]
  );

  const SquareRenderer: CustomSquareRenderer = useMemo(() => {
    return getSquareRenderer({
      currentPositionAtom: currentPositionAtom,
      clickedSquaresAtom,
      playableSquaresAtom,
      checkedKingAtom,
      threatenedSquaresAtom,
      cuesAtom,
    });
  }, [
    currentPositionAtom,
    clickedSquaresAtom,
    playableSquaresAtom,
    checkedKingAtom,
    threatenedSquaresAtom,
    cuesAtom,
  ]);

  return (
    <Grid
      ref={rootRef}
      container
      justifyContent="center"
      alignItems="center"
      wrap="nowrap"
      width={boardSize}
      sx={{ "--board-size": `${boardSize || 400}px`, maxWidth: "100%" }}
    >
      {(showEvaluationBar || stage) && (
        <Box
          sx={{
            width: { xs: "1.6rem", sm: "2rem" },
            flexShrink: 0,
            alignSelf: "stretch",
            position: "relative",
          }}
        >
          <Box sx={{ position: "absolute", top: barTop, left: 0 }}>
            {showEvaluationBar && (
              <EvaluationBar
                height={pixels ?? boardSize ?? 400}
                boardOrientation={boardOrientation}
                currentPositionAtom={currentPositionAtom}
                key={gameIdentity}
                fen={gameFen}
              />
            )}
          </Box>
        </Box>
      )}

      <Grid
        ref={stackRef}
        container
        rowGap={1.5}
        justifyContent="center"
        alignItems="center"
        paddingLeft={{
          xs: stage || showEvaluationBar ? 0.5 : 0,
          sm: stage || showEvaluationBar ? 2 : 0,
        }}
        size="grow"
        sx={{ minWidth: 0, flexWrap: "nowrap", flexDirection: "column" }}
      >
        {header}

        <PlayerHeader
          previewFen={previewFen}
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
          sx={{
            aspectRatio: "1 / 1",
            width: "100%",
            minWidth: 0,
            position: "relative",
            borderRadius: demonstrationFrame ? "10px" : 0,
            boxShadow: demonstrationFrame
              ? "0 0 0 3px rgba(245, 184, 46, 0.72), 0 10px 28px rgba(0, 0, 0, 0.28)"
              : "none",
            transition: "box-shadow 220ms ease",
          }}
          size={12}
          onMouseDownCapture={(event) => {
            if (event.button === 2 && isDragging.current) cancelBoardInput();
          }}
          {...handlers}
        >
          <Box sx={{ position: "absolute", inset: 0 }}>
            <Chessboard
              id={boardId}
              boardWidth={pixels}
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
              onPromotionCheck={() => false}
              customSquareStyles={{
                ...(moveClickFrom && !previewFen
                  ? {
                      [moveClickFrom]: {
                        boxShadow: "inset 0 0 0 3px rgba(72, 119, 194, .9)",
                      },
                    }
                  : {}),
                ...(queuedMove && allowPremove
                  ? {
                      [queuedMove.from]: {
                        backgroundColor: "rgba(140, 104, 199, .45)",
                      },
                      [queuedMove.to]: {
                        backgroundColor: "rgba(140, 104, 199, .65)",
                      },
                    }
                  : {}),
              }}
              showPromotionDialog={showPromotionDialog}
              promotionToSquare={moveClickTo}
              animationDuration={PIECE_SLIDE_MS}
              motionKey={motionKey}
              customPieces={appearance.customPieces}
            />
          </Box>
          <ArrowLayer
            arrows={arrows ?? NO_ARROWS}
            ink={ink}
            draft={draft}
            orientation={orientation}
            turn={turn}
            fen={gameFen}
            size={pixels}
            masking
            qualityMarkedSquare={
              previewFen ? undefined : (qualityMark?.square ?? verdict?.square)
            }
          />
          {!previewFen && verdict && !qualityMark && (
            <VerdictMark verdict={verdict} orientation={orientation} />
          )}
          {!previewFen &&
            qualityMark &&
            !drawResult?.kings.some(
              (king) => king.square === qualityMark.square
            ) && <QualityIcon mark={qualityMark} orientation={orientation} />}
          <DrawBadges result={drawResult} orientation={orientation} />
        </Grid>

        <PlayerHeader
          previewFen={previewFen}
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
