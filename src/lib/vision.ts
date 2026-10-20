export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

export const ALL_SQUARES: string[] = RANKS.flatMap((rank) =>
  FILES.map((file) => file + rank)
);

const KNIGHT_STEPS: [number, number][] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

const toCoords = (square: string): [number, number] => [
  FILES.indexOf(square[0] as (typeof FILES)[number]),
  Number(square[1]) - 1,
];

const fromCoords = (file: number, rank: number): string =>
  FILES[file] + RANKS[rank];

export const isSquare = (value: string): boolean => /^[a-h][1-8]$/.test(value);

export const isLightSquare = (square: string): boolean => {
  const [file, rank] = toCoords(square);
  return (file + rank) % 2 === 1;
};

export const randomSquare = (
  exclude?: string,
  random: () => number = Math.random
): string => {
  const choices = exclude
    ? ALL_SQUARES.filter((square) => square !== exclude)
    : ALL_SQUARES;

  return choices[Math.floor(random() * choices.length) % choices.length];
};

export const knightMoves = (square: string): string[] => {
  const [file, rank] = toCoords(square);

  return KNIGHT_STEPS.map(([df, dr]) => [file + df, rank + dr])
    .filter(([f, r]) => f >= 0 && f < 8 && r >= 0 && r < 8)
    .map(([f, r]) => fromCoords(f, r));
};

export const isKnightMove = (from: string, to: string): boolean =>
  knightMoves(from).includes(to);

export const knightPath = (from: string, to: string): string[] => {
  if (from === to) return [from];

  const previous = new Map<string, string>();
  const queue = [from];
  previous.set(from, from);

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];

    for (const next of knightMoves(current)) {
      if (previous.has(next)) continue;
      previous.set(next, current);

      if (next === to) {
        const path = [to];
        let step = current;
        while (step !== from) {
          path.unshift(step);
          step = previous.get(step) as string;
        }
        return [from, ...path];
      }

      queue.push(next);
    }
  }

  return [];
};

export const knightDistance = (from: string, to: string): number =>
  knightPath(from, to).length - 1;

export const randomKnightRoute = (
  minMoves: number,
  maxMoves: number,
  random: () => number = Math.random
): { from: string; to: string; moves: number } => {
  for (let attempt = 0; attempt < 200; attempt++) {
    const from = randomSquare(undefined, random);
    const to = randomSquare(from, random);
    const moves = knightDistance(from, to);

    if (moves >= minMoves && moves <= maxMoves) return { from, to, moves };
  }

  return { from: "b1", to: "c3", moves: 1 };
};
