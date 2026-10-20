import { PUZZLE_THEMES } from "@/lib/puzzles";
import { storedAtom } from "@/lib/storedAtom";
import { Chess } from "chess.js";
import { atom } from "jotai";

export type PuzzleSource = "lichess" | "daily" | "offline" | "mistakes";
export type PreferredSource = Exclude<PuzzleSource, "mistakes">;

export const SEEN_LIMIT = 15;

export const puzzleGameAtom = atom(new Chess());

export const preferredSourceAtom = storedAtom<PreferredSource>(
  "puzzle-source",
  "lichess",
  (value): value is PreferredSource =>
    value === "lichess" || value === "daily" || value === "offline"
);

export const puzzleThemeAtom = storedAtom<string>(
  "puzzle-theme",
  "mix",
  (value): value is string =>
    typeof value === "string" && PUZZLE_THEMES.some(({ id }) => id === value)
);

export const seenPuzzlesAtom = storedAtom<string[]>(
  "puzzle-seen",
  [],
  (value): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === "string")
);
