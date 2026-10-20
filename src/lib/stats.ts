import { storedAtom } from "./storedAtom";

export interface Stats {
  puzzles: {
    solved: number;
    failed: number;
    rating: number;
    streak: number;
    bestStreak: number;
  };
  games: { played: number; won: number; drawn: number; lost: number };
  vision: { bestScore: number; sessions: number };
  openings: { learned: string[] };
  endgames: { completed: string[] };
}

export type GameOutcome = "won" | "drawn" | "lost";

export const DEFAULT_STATS: Stats = {
  puzzles: { solved: 0, failed: 0, rating: 1200, streak: 0, bestStreak: 0 },
  games: { played: 0, won: 0, drawn: 0, lost: 0 },
  vision: { bestScore: 0, sessions: 0 },
  openings: { learned: [] },
  endgames: { completed: [] },
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStats = (value: unknown): value is Stats =>
  isObject(value) &&
  isObject(value.puzzles) &&
  isObject(value.games) &&
  isObject(value.vision) &&
  isObject(value.openings) &&
  Array.isArray(value.openings.learned) &&
  isObject(value.endgames) &&
  Array.isArray(value.endgames.completed);

export const statsAtom = storedAtom<Stats>("chesskit-stats", DEFAULT_STATS, isStats);

const PUZZLE_K_FACTOR = 32;

export const getExpectedScore = (rating: number, opponentRating: number) =>
  1 / (1 + Math.pow(10, (opponentRating - rating) / 400));

export const recordPuzzle = (
  stats: Stats,
  puzzleRating: number,
  solved: boolean
): Stats => {
  const { puzzles } = stats;
  const expected = getExpectedScore(puzzles.rating, puzzleRating);
  const rating = Math.round(
    puzzles.rating + PUZZLE_K_FACTOR * ((solved ? 1 : 0) - expected)
  );
  const streak = solved ? puzzles.streak + 1 : 0;

  return {
    ...stats,
    puzzles: {
      solved: puzzles.solved + (solved ? 1 : 0),
      failed: puzzles.failed + (solved ? 0 : 1),
      rating: Math.max(100, rating),
      streak,
      bestStreak: Math.max(puzzles.bestStreak, streak),
    },
  };
};

export const recordGame = (stats: Stats, outcome: GameOutcome): Stats => ({
  ...stats,
  games: {
    played: stats.games.played + 1,
    won: stats.games.won + (outcome === "won" ? 1 : 0),
    drawn: stats.games.drawn + (outcome === "drawn" ? 1 : 0),
    lost: stats.games.lost + (outcome === "lost" ? 1 : 0),
  },
});

export const recordVision = (stats: Stats, score: number): Stats => ({
  ...stats,
  vision: {
    bestScore: Math.max(stats.vision.bestScore, score),
    sessions: stats.vision.sessions + 1,
  },
});

export const markOpeningLearned = (stats: Stats, openingId: string): Stats =>
  stats.openings.learned.includes(openingId)
    ? stats
    : {
        ...stats,
        openings: { learned: [...stats.openings.learned, openingId] },
      };

export const markEndgameCompleted = (stats: Stats, endgameId: string): Stats =>
  stats.endgames.completed.includes(endgameId)
    ? stats
    : {
        ...stats,
        endgames: { completed: [...stats.endgames.completed, endgameId] },
      };
