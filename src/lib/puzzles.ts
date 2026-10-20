import { Chess } from "chess.js";
import { MistakeEntry } from "./mistakes";
import { loadGameFromText } from "./pgn";

export interface Puzzle {
  id: string;
  fen: string;
  solution: string[];
  rating?: number;
  themes: string[];
  source: "lichess" | "mistake" | "offline";
  lastMove?: string;
  url?: string;
  description?: string;
}

export type MoveVerdict = "correct" | "wrong" | "mate";

export const PUZZLE_THEMES: { id: string; label: string }[] = [
  { id: "mix", label: "Anything" },
  { id: "mateIn1", label: "Mate in 1" },
  { id: "mateIn2", label: "Mate in 2" },
  { id: "mateIn3", label: "Mate in 3" },
  { id: "fork", label: "Fork" },
  { id: "pin", label: "Pin" },
  { id: "skewer", label: "Skewer" },
  { id: "discoveredAttack", label: "Discovered attack" },
  { id: "hangingPiece", label: "Hanging piece" },
  { id: "backRankMate", label: "Back rank" },
  { id: "sacrifice", label: "Sacrifice" },
  { id: "endgame", label: "Endgame" },
  { id: "opening", label: "Opening" },
  { id: "short", label: "Short" },
];

interface LichessPuzzleResponse {
  game: { id?: string; pgn: string };
  puzzle: {
    id: string;
    rating: number;
    solution: string[];
    themes: string[];
    initialPly: number;
    fen?: string;
    lastMove?: string;
  };
}

export const puzzleFromLichess = (response: LichessPuzzleResponse): Puzzle => {
  const { game, puzzle } = response;

  let fen = puzzle.fen;
  let lastMove = puzzle.lastMove;

  if (!fen) {
    const replay = new Chess();
    const history = loadGameFromText(game.pgn).history({ verbose: true });
    const played = history.slice(0, puzzle.initialPly + 1);
    for (const move of played) replay.move(move.san);

    fen = replay.fen();
    const last = played.at(-1);
    lastMove = last ? last.from + last.to + (last.promotion ?? "") : undefined;
  }

  return {
    id: puzzle.id,
    fen,
    solution: puzzle.solution,
    rating: puzzle.rating,
    themes: puzzle.themes,
    source: "lichess",
    lastMove,
    url: `https://lichess.org/training/${puzzle.id}`,
  };
};

export const checkPuzzleMove = (
  puzzle: Puzzle,
  step: number,
  fenBefore: string,
  uci: string
): MoveVerdict => {
  if (puzzle.solution[step] === uci) return "correct";

  try {
    const game = new Chess(fenBefore);
    game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.slice(4, 5) || undefined,
    });
    if (game.isCheckmate()) return "mate";
  } catch {
    return "wrong";
  }

  return "wrong";
};

export const mistakeToPuzzle = (entry: MistakeEntry): Puzzle | undefined => {
  if (!entry.bestUci) return undefined;

  return {
    id: `mistake-${entry.gameId}-${entry.ply}`,
    fen: entry.fenBefore,
    solution: [entry.bestUci],
    themes: ["Your mistake"],
    source: "mistake",
    description: `In ${entry.gameLabel} you played ${entry.san}, which was a ${entry.classification}. Find the better move.`,
  };
};

export const solverColor = (puzzle: Puzzle): "w" | "b" =>
  new Chess(puzzle.fen).turn();

export const fetchLichessPuzzle = async (
  angle: string,
  signal?: AbortSignal
): Promise<Puzzle> => {
  const query =
    angle && angle !== "mix" ? `?angle=${encodeURIComponent(angle)}` : "";
  const response = await fetch(`https://lichess.org/api/puzzle/next${query}`, {
    signal,
  });
  if (!response.ok) throw new Error(`Lichess answered ${response.status}`);

  return puzzleFromLichess((await response.json()) as LichessPuzzleResponse);
};

export const fetchDailyPuzzle = async (
  signal?: AbortSignal
): Promise<Puzzle> => {
  const response = await fetch("https://lichess.org/api/puzzle/daily", {
    signal,
  });
  if (!response.ok) throw new Error(`Lichess answered ${response.status}`);

  return puzzleFromLichess((await response.json()) as LichessPuzzleResponse);
};
