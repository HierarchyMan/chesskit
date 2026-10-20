import { Color } from "@/types/enums";
import { Box } from "@mui/material";
import { CSSProperties, useId, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Arrow } from "react-chessboard/dist/chessboard/types";
import { useBoardAppearance } from "./appearance";

interface Props {
  fen: string;
  size: number;
  orientation?: Color;
  arrows?: Arrow[];
  lastMove?: { from: string; to: string };
  squareStyles?: Record<string, CSSProperties>;
  animationDuration?: number;
  showCoordinates?: boolean;
}

const LAST_MOVE_STYLE: CSSProperties = {
  backgroundColor: "rgba(255, 213, 65, 0.5)",
};

export default function MiniBoard({
  fen,
  size,
  orientation = Color.White,
  arrows,
  lastMove,
  squareStyles: extraSquareStyles,
  animationDuration = 250,
  showCoordinates,
}: Props) {
  const appearance = useBoardAppearance();
  const id = useId();

  const squareStyles = useMemo(
    () => ({
      ...(lastMove
        ? { [lastMove.from]: LAST_MOVE_STYLE, [lastMove.to]: LAST_MOVE_STYLE }
        : {}),
      ...(extraSquareStyles ?? {}),
    }),
    [lastMove, extraSquareStyles]
  );

  return (
    <Box sx={{ width: size, height: size, flexShrink: 0 }}>
      <Chessboard
        id={`mini-${id}`}
        position={fen}
        boardWidth={size}
        arePiecesDraggable={false}
        areArrowsAllowed={false}
        boardOrientation={orientation === Color.White ? "white" : "black"}
        customArrows={arrows}
        customSquareStyles={squareStyles}
        customBoardStyle={appearance.customBoardStyle}
        customDarkSquareStyle={appearance.customDarkSquareStyle}
        customLightSquareStyle={appearance.customLightSquareStyle}
        customPieces={appearance.customPieces}
        showBoardNotation={showCoordinates ?? appearance.showBoardNotation}
        animationDuration={animationDuration}
      />
    </Box>
  );
}
