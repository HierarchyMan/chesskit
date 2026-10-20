import { useBoardAppearance } from "@/components/board/appearance";
import {
  movePiece,
  placePiece,
  PieceCode,
  validatePosition,
} from "@/lib/editorPosition";
import { Box, Grid2 as Grid } from "@mui/material";
import { useAtom, useAtomValue } from "jotai";
import { useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Square } from "react-chessboard/dist/chessboard/types";
import { useAnalysisBoardSize } from "../hooks/useAnalysisBoardSize";
import {
  arrangeBrushAtom,
  boardOrientationAtom,
  editablePositionAtom,
} from "../states";

export const ARRANGE_BOARD_ID = "ArrangeBoard";

type BoardPositionObject = Record<string, PieceCode>;

export default function ArrangeBoard() {
  const boardSize = useAnalysisBoardSize();
  const orientation = useAtomValue(boardOrientationAtom);
  const [position, setPosition] = useAtom(editablePositionAtom);
  const brush = useAtomValue(arrangeBrushAtom);
  const appearance = useBoardAppearance();

  const validation = useMemo(() => validatePosition(position), [position]);

  const removeAt = (square: Square) =>
    setPosition((current) => placePiece(current, square, null));

  const handleSquareClick = (square: Square) => {
    if (brush === "hand") return;

    setPosition((current) =>
      placePiece(current, square, brush === "erase" ? null : brush)
    );
  };

  return (
    <Grid
      container
      justifyContent="center"
      alignItems="center"
      wrap="nowrap"
      width={boardSize}
    >
      <Box
        sx={{
          width: "100%",
          borderRadius: "8px",
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
          animationDuration={120}
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
    </Grid>
  );
}
