import { Box } from "@mui/material";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { CustomPieces, Piece } from "react-chessboard/dist/chessboard/types";
import {
  BOARD_THEMES,
  boardHueAtom,
  boardThemeAtom,
  pieceSetAtom,
  showCoordinatesAtom,
} from "./states";

export const PIECE_CODES = [
  "wP",
  "wB",
  "wN",
  "wR",
  "wQ",
  "wK",
  "bP",
  "bB",
  "bN",
  "bR",
  "bQ",
  "bK",
] as const satisfies Piece[];

export interface BoardAppearance {
  customPieces: CustomPieces;
  customDarkSquareStyle: Record<string, string>;
  customLightSquareStyle: Record<string, string>;
  customBoardStyle: Record<string, string | number>;
  showBoardNotation: boolean;
}

export const useBoardAppearance = (): BoardAppearance => {
  const pieceSet = useAtomValue(pieceSetAtom);
  const boardHue = useAtomValue(boardHueAtom);
  const boardTheme = useAtomValue(boardThemeAtom);
  const showBoardNotation = useAtomValue(showCoordinatesAtom);

  const customPieces = useMemo(
    () =>
      PIECE_CODES.reduce<CustomPieces>((acc, piece) => {
        acc[piece] = ({ squareWidth }) => (
          <Box
            width={squareWidth}
            height={squareWidth}
            sx={{
              backgroundImage: `url(/piece/${pieceSet}/${piece}.svg)`,
              backgroundSize: "contain",
            }}
          />
        );

        return acc;
      }, {}),
    [pieceSet]
  );

  const customBoardStyle = useMemo<Record<string, string | number>>(
    () => ({
      borderRadius: "5px",
      boxShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
      ...(boardHue ? { filter: `hue-rotate(${boardHue}deg)` } : {}),
    }),
    [boardHue]
  );

  const theme = BOARD_THEMES[boardTheme];

  return {
    customPieces,
    customBoardStyle,
    customDarkSquareStyle: { backgroundColor: theme.dark },
    customLightSquareStyle: { backgroundColor: theme.light },
    showBoardNotation,
  };
};
