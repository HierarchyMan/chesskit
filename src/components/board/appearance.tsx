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

const rotateHexHue = (hex: string, degrees: number): string => {
  const normalized = ((degrees % 360) + 360) % 360;
  if (normalized === 0) return hex;

  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;

  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return hex;

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = ((h * 60 + normalized) % 360) / 360;

  const hueToChannel = (p: number, q: number, t: number) => {
    const wrapped = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (wrapped < 1 / 6) return p + (q - p) * 6 * wrapped;
    if (wrapped < 1 / 2) return q;
    if (wrapped < 2 / 3) return p + (q - p) * (2 / 3 - wrapped) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const toHex = (channel: number) =>
    Math.round(Math.min(1, Math.max(0, channel)) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(hueToChannel(p, q, h + 1 / 3))}${toHex(hueToChannel(p, q, h))}${toHex(hueToChannel(p, q, h - 1 / 3))}`;
};

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
      borderRadius: "6px",
      boxShadow: "0 2px 10px rgba(0, 0, 0, 0.35)",
    }),
    []
  );

  const theme = BOARD_THEMES[boardTheme];
  const { customDarkSquareStyle, customLightSquareStyle } = useMemo(
    () => ({
      customDarkSquareStyle: {
        backgroundColor: rotateHexHue(theme.dark, boardHue),
      },
      customLightSquareStyle: {
        backgroundColor: rotateHexHue(theme.light, boardHue),
      },
    }),
    [theme.dark, theme.light, boardHue]
  );

  return {
    customPieces,
    customBoardStyle,
    customDarkSquareStyle,
    customLightSquareStyle,
    showBoardNotation,
  };
};
