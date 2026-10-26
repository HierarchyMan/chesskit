import { BoardArrow } from "@/lib/arrows/types";
import { Color } from "@/types/enums";
import { Box } from "@mui/material";
import { CSSProperties, useId, useMemo } from "react";
import Chessboard from "./motionChessboard";
import ArrowLayer from "./arrowLayer";
import { useBoardAppearance } from "./appearance";
import DrawBadges from "./drawBadges";
import { getBoardDraw } from "@/lib/boardDraw";
import { Chess } from "chess.js";
import { PIECE_SLIDE_MS } from "@/lib/pieceMotion";

interface Props {
  fen: string;
  size: number;
  orientation?: Color;
  arrows?: BoardArrow[];
  lastMove?: { from: string; to: string };
  squareStyles?: Record<string, CSSProperties>;
  animationDuration?: number;
  showCoordinates?: boolean;
  game?: Chess;
  recordedDraw?: boolean;
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
  animationDuration = PIECE_SLIDE_MS,
  showCoordinates,
  game,
  recordedDraw,
}: Props) {
  const appearance = useBoardAppearance();
  const id = useId();
  const drawResult = useMemo(
    () => getBoardDraw(game?.fen() === fen ? game : fen, null, recordedDraw),
    [game, fen, recordedDraw]
  );

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
    <Box
      sx={{ width: size, height: size, flexShrink: 0, position: "relative" }}
    >
      <Chessboard
        id={`mini-${id}`}
        position={fen}
        boardWidth={size}
        arePiecesDraggable={false}
        areArrowsAllowed={false}
        boardOrientation={orientation === Color.White ? "white" : "black"}
        customSquareStyles={squareStyles}
        customBoardStyle={appearance.customBoardStyle}
        customDarkSquareStyle={appearance.customDarkSquareStyle}
        customLightSquareStyle={appearance.customLightSquareStyle}
        customPieces={appearance.customPieces}
        showBoardNotation={showCoordinates ?? appearance.showBoardNotation}
        animationDuration={animationDuration}
      />
      {arrows && arrows.length > 0 && (
        <ArrowLayer
          arrows={arrows}
          orientation={orientation === Color.White ? "white" : "black"}
          turn={fen.split(" ")[1] === "b" ? "b" : "w"}
          fen={fen}
          size={size}
          masking
        />
      )}
      <DrawBadges
        result={drawResult}
        orientation={orientation === Color.White ? "white" : "black"}
      />
    </Box>
  );
}
