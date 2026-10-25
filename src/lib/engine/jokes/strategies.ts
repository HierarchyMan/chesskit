import { EngineName } from "@/types/enums";
import { Chess, Move, PieceSymbol, Square } from "chess.js";

/**
 * How each joke engine ranks the legal moves. A strategy returns every legal
 * move in its order of preference; the engine plays the first one.
 */

export interface JokeContext {
  fen: string;
  moves: Move[];
  // Advisor scores in centipawns from the mover's point of view (mates are ±100000).
  scores?: ReadonlyMap<string, number>;
  random: () => number;
}

export type JokeStrategy = (context: JokeContext) => string[];

export type JokeEngineName =
  | EngineName.Drawfish
  | EngineName.Worstfish
  | EngineName.RandomMover
  | EngineName.Alphabetical
  | EngineName.Cccp
  | EngineName.Pacifist
  | EngineName.Bongcloud
  | EngineName.Swarm
  | EngineName.Huddle
  | EngineName.Generous;

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export const moveToUci = (move: Move): string =>
  move.from + move.to + (move.promotion ?? "");

const shuffle = <T>(items: T[], random: () => number): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

/** Shuffles first, so moves the key cannot tell apart come out in random order. */
const rankBy = (context: JokeContext, key: (move: Move) => number): string[] =>
  shuffle(context.moves, context.random)
    .map((move) => ({ move, key: key(move) }))
    .sort((a, b) => a.key - b.key)
    .map(({ move }) => moveToUci(move));

const score = (context: JokeContext, move: Move): number =>
  context.scores?.get(moveToUci(move)) ?? 0;

const after = (fen: string, move: Move): Chess => {
  const game = new Chess(fen);
  game.move({ from: move.from, to: move.to, promotion: move.promotion });
  return game;
};

const squareCoords = (square: Square): [number, number] => [
  square.charCodeAt(0) - 97,
  Number(square[1]) - 1,
];

const distance = (a: Square, b: Square): number => {
  const [ax, ay] = squareCoords(a);
  const [bx, by] = squareCoords(b);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
};

const pieceSquares = (game: Chess, color: "w" | "b") =>
  game
    .board()
    .flat()
    .filter((piece) => piece?.color === color)
    .map((piece) => piece!);

const kingSquare = (game: Chess, color: "w" | "b"): Square | undefined =>
  pieceSquares(game, color).find((piece) => piece.type === "k")?.square;

const isCapture = (move: Move): boolean => !!move.captured;
const givesCheck = (move: Move): boolean => /[+#]$/.test(move.san);

// Sum of distances from the mover's pieces (king excluded) to a target king.
const spread = (
  context: JokeContext,
  move: Move,
  target: "own" | "enemy"
): number => {
  const game = after(context.fen, move);
  const mover = move.color;
  const king = kingSquare(game, target === "own" ? mover : game.turn());
  if (!king) return 0;
  return pieceSquares(game, mover)
    .filter((piece) => piece.type !== "k")
    .reduce((total, piece) => total + distance(piece.square, king), 0);
};

// The most valuable piece the opponent can take right after this move.
const biggestGift = (context: JokeContext, move: Move): number => {
  const game = after(context.fen, move);
  return game
    .moves({ verbose: true })
    .reduce(
      (best, reply) =>
        Math.max(best, reply.captured ? PIECE_VALUES[reply.captured] : 0),
      0
    );
};

const cccpClass = (move: Move): number => {
  if (move.san.endsWith("#")) return 0;
  if (givesCheck(move)) return 1;
  if (isCapture(move)) return 2 - PIECE_VALUES[move.captured!] / 10;
  if (move.piece === "p") {
    const rank = Number(move.to[1]);
    const advanced = move.color === "w" ? rank : 9 - rank;
    return 3 - advanced / 10;
  }
  return 4;
};

export const JOKE_STRATEGIES: Record<JokeEngineName, JokeStrategy> = {
  [EngineName.Drawfish]: (context) =>
    rankBy(context, (move) => Math.abs(score(context, move))),
  [EngineName.Worstfish]: (context) =>
    rankBy(context, (move) => score(context, move)),
  [EngineName.RandomMover]: (context) => rankBy(context, () => 0),
  [EngineName.Alphabetical]: (context) =>
    [...context.moves]
      .sort((a, b) => (a.san < b.san ? -1 : a.san > b.san ? 1 : 0))
      .map(moveToUci),
  [EngineName.Cccp]: (context) => rankBy(context, cccpClass),
  [EngineName.Pacifist]: (context) =>
    rankBy(
      context,
      (move) =>
        // Violent moves sort after every peaceful one; best score first within each.
        (isCapture(move) || givesCheck(move) ? 1e7 : 0) - score(context, move)
    ),
  [EngineName.Bongcloud]: (context) =>
    rankBy(
      context,
      (move) => (move.piece === "k" ? 0 : 1e7) - score(context, move)
    ),
  [EngineName.Swarm]: (context) =>
    rankBy(context, (move) => spread(context, move, "enemy")),
  [EngineName.Huddle]: (context) =>
    rankBy(context, (move) => spread(context, move, "own")),
  [EngineName.Generous]: (context) =>
    rankBy(context, (move) => -biggestGift(context, move)),
};

export const isJokeEngineName = (name: string): name is JokeEngineName =>
  name in JOKE_STRATEGIES;
