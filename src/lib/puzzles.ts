import { Chess } from "chess.js";
import { MistakeEntry, moverPercentage } from "./mistakes";
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
  alternatives?: string[];
}

export type MoveVerdict = "correct" | "wrong" | "mate";

export type StepOutcome =
  | { verdict: "wrong" }
  | {
      verdict: "correct" | "mate";
      solved: boolean;
      reply?: string;
      nextStep: number;
    };

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

const ALTERNATIVE_MARGIN = 3;

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
  if (step === 0 && puzzle.alternatives?.includes(uci)) return "correct";

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

export const evaluatePuzzleStep = (
  puzzle: Puzzle,
  step: number,
  fenBefore: string,
  uci: string
): StepOutcome => {
  const verdict = checkPuzzleMove(puzzle, step, fenBefore, uci);
  if (verdict === "wrong") return { verdict };
  if (verdict === "mate") {
    return { verdict, solved: true, nextStep: puzzle.solution.length };
  }

  const isAlternative = puzzle.solution[step] !== uci;
  const afterUser = step + 1;
  if (isAlternative || afterUser >= puzzle.solution.length) {
    return { verdict, solved: true, nextStep: puzzle.solution.length };
  }

  const reply = puzzle.solution[afterUser];
  const afterReply = afterUser + 1;

  return {
    verdict,
    solved: afterReply >= puzzle.solution.length,
    reply,
    nextStep: afterReply,
  };
};

export const solutionToSan = (puzzle: Puzzle): string[] => {
  const game = new Chess(puzzle.fen);
  const moves: string[] = [];

  for (const uci of puzzle.solution) {
    try {
      const move = game.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.slice(4, 5) || undefined,
      });
      moves.push(move.san);
    } catch {
      break;
    }
  }

  return moves;
};

const alternativeMoves = (entry: MistakeEntry): string[] => {
  const [best, ...rest] = entry.beforeLines;
  if (!best || !best.pv[0]) return [];

  const bestScore = moverPercentage(best, entry.color);

  return rest
    .filter((line) => {
      const first = line.pv[0];
      if (!first || first === best.pv[0] || first === entry.playedUci) {
        return false;
      }
      return (
        moverPercentage(line, entry.color) >= bestScore - ALTERNATIVE_MARGIN
      );
    })
    .map((line) => line.pv[0]);
};

export const mistakeToPuzzle = (entry: MistakeEntry): Puzzle | undefined => {
  if (!entry.bestUci) return undefined;

  return {
    id: `mistake-${entry.gameId}-${entry.ply}`,
    fen: entry.fenBefore,
    solution: [entry.bestUci],
    alternatives: alternativeMoves(entry),
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
    cache: "no-store",
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
