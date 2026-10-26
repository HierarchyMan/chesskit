import { Puzzle } from "./puzzles";
import data from "@/data/offlinePuzzles.json";

export const OFFLINE_PUZZLES: Puzzle[] = (
  data as {
    id: string;
    fen: string;
    solution: string[];
    rating: number;
    themes: string[];
    setupFen?: string;
    lastMove?: string;
  }[]
).map((puzzle) => ({ ...puzzle, source: "offline" as const }));

export const pickOfflinePuzzle = (
  theme: string,
  seen: string[],
  random: () => number = Math.random,
  pool: Puzzle[] = OFFLINE_PUZZLES
): { puzzle: Puzzle; themeMatched: boolean } | undefined => {
  if (pool.length === 0) return undefined;

  const matching =
    theme === "mix"
      ? pool
      : pool.filter((puzzle) => puzzle.themes.includes(theme));
  const themeMatched = matching.length > 0;
  const candidates = themeMatched ? matching : pool;
  const unseen = candidates.filter((puzzle) => !seen.includes(puzzle.id));
  const choices = unseen.length > 0 ? unseen : candidates;

  return {
    puzzle: choices[Math.floor(random() * choices.length) % choices.length],
    themeMatched,
  };
};
