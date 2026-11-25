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
  | EngineName.Secondfish
  | EngineName.Medianfish
  | EngineName.Chokefish
  | EngineName.Roulette
  | EngineName.Anarchy
  | EngineName.Berserker
  | EngineName.QueenLover
  | EngineName.Knightmare
  | EngineName.RandomMover
  | EngineName.Alphabetical
  | EngineName.ReverseAlphabetical
  | EngineName.Cccp
  | EngineName.Pacifist
  | EngineName.Bongcloud
  | EngineName.Swarm
  | EngineName.Huddle
  | EngineName.Generous
  | EngineName.MinOpponentMoves
  | EngineName.MaxOpponentMoves
  | EngineName.Mirror
  | EngineName.SameColor
  | EngineName.OppositeColor
  | EngineName.SuicideKing
  | EngineName.ReverseStarting
  | EngineName.StalemateSeeker
  | EngineName.Sniper
  | EngineName.Lazy
  | EngineName.EdgeLord
  | EngineName.Center
  | EngineName.SocialDistancer
  | EngineName.Greedy
  | EngineName.Aristocrat;

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const ARISTOCRAT_ORDER: Record<PieceSymbol, number> = {
  q: 0,
  r: 1,
  b: 2,
  n: 3,
  k: 4,
  p: 5,
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

const isLightSquare = (square: Square): boolean => {
  const [x, y] = squareCoords(square);
  return (x + y) % 2 === 1;
};

const squareColorRank = (move: Move, wantLight: boolean): number => {
  const toMatches = isLightSquare(move.to) === wantLight;
  const fromMatches = isLightSquare(move.from) === wantLight;
  if (!fromMatches && toMatches) return 0;
  if (fromMatches && toMatches) return 1;
  if (!fromMatches && !toMatches) return 2;
  return 3;
};

const moveDistSq = (move: Move): number => {
  const [ax, ay] = squareCoords(move.from);
  const [bx, by] = squareCoords(move.to);
  return (ax - bx) ** 2 + (ay - by) ** 2;
};

const centerDist = (square: Square): number => {
  const [x, y] = squareCoords(square);
  return Math.hypot(x - 3.5, y - 3.5);
};

const verticalSymmetry = (game: Chess): number => {
  const board = game.board();
  let total = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 8; col++) {
      const top = board[row][col];
      const bottom = board[7 - row][col];
      if (!top && !bottom) total += 1;
      else if (top && bottom && top.color !== bottom.color) {
        total += top.type === bottom.type ? 2 : 0.5;
      }
    }
  }
  return total;
};

const meanPairwiseDistance = (game: Chess): number => {
  const coords = game
    .board()
    .flat()
    .filter((piece): piece is NonNullable<typeof piece> => !!piece)
    .map((piece) => squareCoords(piece.square));
  if (coords.length < 2) return 0;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      total += Math.hypot(
        coords[i][0] - coords[j][0],
        coords[i][1] - coords[j][1]
      );
      pairs++;
    }
  }
  return total / pairs;
};

const suicideKingKey = (context: JokeContext, move: Move): number => {
  const next = after(context.fen, move);
  const own = kingSquare(next, move.color);
  const enemy = kingSquare(next, next.turn());
  const d = own && enemy ? distance(own, enemy) : 0;
  return d * 2 + (move.piece === "k" ? 0 : 1);
};

const minOpponentMovesKey = (context: JokeContext, move: Move): number => {
  const next = after(context.fen, move);
  if (next.isCheckmate()) return -1;
  return next.moves().length;
};

const stalemateSeekerKey = (context: JokeContext, move: Move): number => {
  const next = after(context.fen, move);
  if (next.isStalemate()) return -1000;
  if (next.isCheckmate()) return 10000;
  return next.moves().length + (givesCheck(move) ? 50 : 0);
};

const reverseStartingDelta = (move: Move): number => {
  const fromRank = Number(move.from[1]);
  const toRank = Number(move.to[1]);
  return move.color === "w" ? fromRank - toRank : toRank - fromRank;
};

const greedyKey = (move: Move): number => {
  const capture = move.captured ? PIECE_VALUES[move.captured] * 10 : 0;
  const promo = move.promotion ? PIECE_VALUES[move.promotion] : 0;
  return -(capture + promo);
};

export const JOKE_STRATEGIES: Record<JokeEngineName, JokeStrategy> = {
  [EngineName.Drawfish]: (context) =>
    rankBy(context, (move) => Math.abs(score(context, move))),
  [EngineName.Worstfish]: (context) =>
    rankBy(context, (move) => score(context, move)),
  [EngineName.Secondfish]: (context) => {
    const ranked = rankBy(context, (move) => -score(context, move));
    if (ranked.length >= 2) [ranked[0], ranked[1]] = [ranked[1], ranked[0]];
    return ranked;
  },
  [EngineName.Medianfish]: (context) => {
    const ranked = rankBy(context, (move) => -score(context, move));
    const mid = Math.floor((ranked.length - 1) / 2);
    return ranked
      .map((uci, index) => ({ uci, dist: Math.abs(index - mid) }))
      .sort((a, b) => a.dist - b.dist)
      .map((entry) => entry.uci);
  },
  [EngineName.Chokefish]: (context) => {
    const best = context.moves.reduce(
      (highest, move) => Math.max(highest, score(context, move)),
      -Infinity
    );
    const choking = best >= 150;
    return rankBy(context, (move) =>
      choking ? score(context, move) : -score(context, move)
    );
  },
  [EngineName.Roulette]: (context) => {
    const blunder = context.random() < 1 / 6;
    return rankBy(context, (move) =>
      blunder ? score(context, move) : -score(context, move)
    );
  },
  [EngineName.Anarchy]: (context) =>
    rankBy(
      context,
      (move) =>
        (move.isEnPassant()
          ? 0
          : move.promotion && move.promotion !== "n"
            ? 2e7
            : 1e7) - score(context, move)
    ),
  [EngineName.Berserker]: (context) =>
    rankBy(
      context,
      (move) =>
        (isCapture(move) || givesCheck(move) ? 0 : 1e7) - score(context, move)
    ),
  [EngineName.QueenLover]: (context) =>
    rankBy(
      context,
      (move) => (move.piece === "q" ? 0 : 1e7) - score(context, move)
    ),
  [EngineName.Knightmare]: (context) =>
    rankBy(
      context,
      (move) =>
        (move.piece === "n" || move.promotion === "n"
          ? 0
          : move.promotion
            ? 2e7
            : 1e7) - score(context, move)
    ),
  [EngineName.RandomMover]: (context) => rankBy(context, () => 0),
  [EngineName.Alphabetical]: (context) =>
    [...context.moves]
      .sort((a, b) => (a.san < b.san ? -1 : a.san > b.san ? 1 : 0))
      .map(moveToUci),
  [EngineName.ReverseAlphabetical]: (context) =>
    [...context.moves]
      .sort((a, b) => (a.san > b.san ? -1 : a.san < b.san ? 1 : 0))
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
  [EngineName.MinOpponentMoves]: (context) =>
    rankBy(context, (move) => minOpponentMovesKey(context, move)),
  [EngineName.MaxOpponentMoves]: (context) =>
    rankBy(context, (move) => -after(context.fen, move).moves().length),
  [EngineName.Mirror]: (context) =>
    rankBy(context, (move) => -verticalSymmetry(after(context.fen, move))),
  [EngineName.SameColor]: (context) =>
    rankBy(context, (move) => squareColorRank(move, move.color === "w")),
  [EngineName.OppositeColor]: (context) =>
    rankBy(context, (move) => squareColorRank(move, move.color === "b")),
  [EngineName.SuicideKing]: (context) =>
    rankBy(context, (move) => suicideKingKey(context, move)),
  [EngineName.ReverseStarting]: (context) =>
    rankBy(context, reverseStartingDelta),
  [EngineName.StalemateSeeker]: (context) =>
    rankBy(context, (move) => stalemateSeekerKey(context, move)),
  [EngineName.Sniper]: (context) =>
    rankBy(context, (move) => -moveDistSq(move)),
  [EngineName.Lazy]: (context) => rankBy(context, moveDistSq),
  [EngineName.EdgeLord]: (context) =>
    rankBy(context, (move) => -(centerDist(move.to) - centerDist(move.from))),
  [EngineName.Center]: (context) =>
    rankBy(context, (move) => centerDist(move.to) - centerDist(move.from)),
  [EngineName.SocialDistancer]: (context) =>
    rankBy(context, (move) => -meanPairwiseDistance(after(context.fen, move))),
  [EngineName.Greedy]: (context) => rankBy(context, greedyKey),
  [EngineName.Aristocrat]: (context) =>
    rankBy(context, (move) => ARISTOCRAT_ORDER[move.piece]),
};

export const isJokeEngineName = (name: string): name is JokeEngineName =>
  name in JOKE_STRATEGIES;
