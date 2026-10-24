import { PIECE_SETS } from "@/constants";
import { storedAtom } from "@/lib/storedAtom";
import { atomWithStorage } from "jotai/utils";

export const pieceSetAtom = atomWithStorage<(typeof PIECE_SETS)[number]>(
  "pieceSet",
  "neo"
);
export const boardHueAtom = atomWithStorage("boardHue", 0);

export const BOARD_THEMES = {
  classic: { label: "Classic", light: "#f0d9b5", dark: "#b58863" },
  green: { label: "Green", light: "#eeeed2", dark: "#769656" },
  blue: { label: "Blue", light: "#dee3e6", dark: "#8ca2ad" },
  ocean: { label: "Ocean", light: "#cfe3f1", dark: "#5b88b0" },
  slate: { label: "Slate", light: "#d9d9d9", dark: "#7a8794" },
  purple: { label: "Purple", light: "#e8e0f0", dark: "#9070a0" },
} as const;

export type BoardThemeName = keyof typeof BOARD_THEMES;

export const boardThemeAtom = storedAtom<BoardThemeName>(
  "boardTheme",
  "green",
  (value): value is BoardThemeName =>
    typeof value === "string" && value in BOARD_THEMES
);

export const showCoordinatesAtom = storedAtom<boolean>(
  "showCoordinates",
  true,
  (value): value is boolean => typeof value === "boolean"
);

export const soundEnabledAtom = storedAtom<boolean>(
  "soundEnabled",
  true,
  (value): value is boolean => typeof value === "boolean"
);
