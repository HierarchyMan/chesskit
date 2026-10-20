import { Game } from "@/types/game";
import { MoveClassification } from "@/types/enums";
import { LineEval } from "@/types/eval";
import { getLineWinPercentage } from "./engine/helpers/winPercentage";
import { loadGameFromText } from "./pgn";

export interface MistakeEntry {
  gameId: number;
  gameLabel: string;
  ply: number;
  moveNumber: number;
  color: "w" | "b";
  san: string;
  classification: MoveClassification;
  fenBefore: string;
  playedUci: string;
  bestUci?: string;
  beforeLines: LineEval[];
  afterLines: LineEval[];
  lostPercentage: number;
  mine: boolean;
}

export const MISTAKE_LEVELS: MoveClassification[] = [
  MoveClassification.Mistake,
  MoveClassification.Blunder,
];

export const moverPercentage = (
  line: LineEval | undefined,
  color: "w" | "b"
): number => {
  if (!line) return 50;
  const white = getLineWinPercentage(line);
  return color === "w" ? white : 100 - white;
};

const whichSideIsMine = (game: Game): "w" | "b" | undefined => {
  if (game.white.name === "You") return "w";
  if (game.black.name === "You") return "b";
  return undefined;
};

export const extractMistakes = (
  game: Game,
  levels: MoveClassification[] = MISTAKE_LEVELS
): MistakeEntry[] => {
  if (!game.eval) return [];

  let chess;
  try {
    chess = loadGameFromText(game.pgn);
  } catch {
    return [];
  }

  const history = chess.history({ verbose: true });
  const { positions } = game.eval;
  if (positions.length !== history.length + 1) return [];

  const mySide = whichSideIsMine(game);
  const label = `${game.white.name} vs ${game.black.name}`;
  const entries: MistakeEntry[] = [];

  history.forEach((move, index) => {
    const after = positions[index + 1];
    const before = positions[index];
    const classification = after.moveClassification;
    if (!classification || !levels.includes(classification)) return;
    if (!before.lines.length || !after.lines.length) return;

    entries.push({
      gameId: game.id,
      gameLabel: label,
      ply: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      color: move.color,
      san: move.san,
      classification,
      fenBefore: move.before,
      playedUci: move.from + move.to + (move.promotion ?? ""),
      bestUci: before.bestMove ?? before.lines[0]?.pv[0],
      beforeLines: before.lines,
      afterLines: after.lines,
      lostPercentage: Math.max(
        0,
        moverPercentage(before.lines[0], move.color) -
          moverPercentage(after.lines[0], move.color)
      ),
      mine: mySide ? mySide === move.color : true,
    });
  });

  return entries;
};

export const collectMistakes = (
  games: Game[],
  options: { onlyMine?: boolean; limit?: number } = {}
): MistakeEntry[] => {
  const all = games
    .flatMap((game) => extractMistakes(game))
    .filter((entry) => !options.onlyMine || entry.mine)
    .sort((a, b) => b.lostPercentage - a.lostPercentage);

  return options.limit ? all.slice(0, options.limit) : all;
};
