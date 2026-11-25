import { useBoardAppearance } from "@/components/board/appearance";
import {
  movePiece,
  placePiece,
  PieceCode,
  validatePosition,
} from "@/lib/editorPosition";
import { Box, Grid2 as Grid, Typography } from "@mui/material";
import { useAtom, useAtomValue } from "jotai";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useBoardStage } from "@/components/boardWorkspace";
import Chessboard from "@/components/board/motionChessboard";
import { PIECE_SLIDE_MS } from "@/lib/pieceMotion";
import { Square } from "react-chessboard/dist/chessboard/types";
import {
  arrangeBrushAtom,
  boardOrientationAtom,
  editablePositionAtom,
} from "../states";

export const ARRANGE_BOARD_ID = "ArrangeBoard";

type BoardPositionObject = Record<string, PieceCode>;

export default function ArrangeBoard() {
  const stage = useBoardStage();
  const boardSize = stage?.width;
  const reportChrome = stage?.reportChrome;
  const rootRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!stackRef.current || !boardRef.current) return;
    const measure = () => {
      const board = boardRef.current?.getBoundingClientRect();
      const stack = stackRef.current?.getBoundingClientRect();
      const root = rootRef.current?.getBoundingClientRect();
      if (board && stack && root) {
        reportChrome?.(stack.height - board.height, root.width - board.width);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stackRef.current);
    observer.observe(boardRef.current);
    if (rootRef.current) observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [reportChrome]);
  const orientation = useAtomValue(boardOrientationAtom);
  const [position, setPosition] = useAtom(editablePositionAtom);
  const brush = useAtomValue(arrangeBrushAtom);
  const appearance = useBoardAppearance();

  const validation = useMemo(() => validatePosition(position), [position]);

  const removeAt = (square: Square) =>
    setPosition((current) => placePiece(current, square, null));

  const handleSquareClick = (square: Square) => {
    if (brush === "hand") return;

    setPosition((current) => {
      if (brush === "erase" || current.pieces[square] === brush) {
        return placePiece(current, square, null);
      }
      return placePiece(current, square, brush);
    });
  };

  return (
    <Grid
      ref={rootRef}
      container
      justifyContent="center"
      alignItems="center"
      wrap="nowrap"
      width={boardSize}
      sx={{ maxWidth: "100%" }}
    >
      {/* Reserve the same eval-bar gutter as AnalysisBoard so toggling Arrange never shifts the board */}
      <Box
        aria-hidden
        sx={{
          width: { xs: "1.6rem", sm: "2rem" },
          flexShrink: 0,
        }}
      />
      <Grid
        ref={stackRef}
        container
        rowGap={0.75}
        justifyContent="center"
        alignItems="center"
        paddingLeft={{ xs: 0.75, sm: 1.25 }}
        size="grow"
        sx={{ minWidth: 0, flexWrap: "nowrap", flexDirection: "column" }}
      >
        <Box
          sx={{
            height: 44,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 0.5,
          }}
        >
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            {orientation ? "Black side" : "White side"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Board editor · drag pieces or click squares
          </Typography>
        </Box>
        <Box
          ref={boardRef}
          sx={{
            width: "100%",
            aspectRatio: "1 / 1",
            borderRadius: "6px",
            outline: validation.ok ? "none" : "3px solid",
            outlineColor: "error.main",
            cursor: brush === "hand" ? "default" : "crosshair",
          }}
        >
          <Chessboard
            id={ARRANGE_BOARD_ID}
            position={position.pieces as BoardPositionObject}
            boardOrientation={orientation ? "white" : "black"}
            areArrowsAllowed={false}
            animationDuration={PIECE_SLIDE_MS}
            dropOffBoardAction="trash"
            onPromotionCheck={() => false}
            onPieceDrop={(source, target) => {
              setPosition((current) => movePiece(current, source, target));
              return true;
            }}
            onSparePieceDrop={(piece, target) => {
              setPosition((current) => placePiece(current, target, piece));
              return true;
            }}
            onPieceDropOffBoard={(source) => removeAt(source)}
            onSquareClick={handleSquareClick}
            onSquareRightClick={removeAt}
            customBoardStyle={appearance.customBoardStyle}
            customDarkSquareStyle={appearance.customDarkSquareStyle}
            customLightSquareStyle={appearance.customLightSquareStyle}
            customPieces={appearance.customPieces}
            showBoardNotation={appearance.showBoardNotation}
          />
        </Box>
        <Box
          sx={{
            height: 94,
            width: "100%",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            pt: 1,
            px: 0.5,
          }}
        >
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            {orientation ? "White side" : "Black side"}
          </Typography>
        </Box>
      </Grid>
    </Grid>
  );
}
