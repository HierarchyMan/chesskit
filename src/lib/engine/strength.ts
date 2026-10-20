export type StrengthMode = "elo" | "depth" | "max";

export interface BotStrength {
  mode: StrengthMode;
  elo: number;
  depth: number;
}

export type MovePlan =
  | { kind: "native"; elo: number; depth: number }
  | { kind: "best"; depth: number }
  | {
      kind: "sampled";
      depth: number;
      multiPv: number;
      temperatureCp: number;
      randomMoveChance: number;
    };

export interface ScoredMove {
  uci: string;
  cp: number;
}

export const MIN_BOT_ELO = 400;
export const MAX_BOT_ELO = 3200;
export const NATIVE_MIN_ELO = 1320;
export const NATIVE_MAX_ELO = 3190;
export const MIN_BOT_DEPTH = 1;
export const MAX_BOT_DEPTH = 30;
export const FULL_STRENGTH_DEPTH = 16;
export const SAMPLED_MULTI_PV = 5;

export const DEFAULT_STRENGTH: BotStrength = {
  mode: "elo",
  elo: 1500,
  depth: 8,
};

export const STRENGTH_PRESETS: { label: string; elo: number }[] = [
  { label: "Beginner", elo: 600 },
  { label: "Casual", elo: 1000 },
  { label: "Club", elo: 1500 },
  { label: "Advanced", elo: 2000 },
  { label: "Master", elo: 2500 },
  { label: "Grandmaster", elo: 3000 },
];

const DEPTH_BY_ELO: [number, number][] = [
  [400, 1],
  [800, 2],
  [1100, 3],
  [1400, 4],
  [1700, 6],
  [2000, 8],
  [2300, 11],
  [2600, 14],
  [2900, 17],
  [3200, 20],
];

const TEMPERATURE_BY_ELO: [number, number][] = [
  [400, 500],
  [600, 350],
  [800, 220],
  [1000, 150],
  [1200, 100],
  [1400, 70],
  [1600, 48],
  [1800, 32],
  [2000, 20],
  [2200, 12],
  [2400, 6],
  [2600, 2],
  [2800, 0],
];

const RANDOM_MOVE_CHANCE_BY_ELO: [number, number][] = [
  [400, 0.22],
  [600, 0.14],
  [800, 0.09],
  [1000, 0.05],
  [1200, 0.025],
  [1400, 0.01],
  [1600, 0.003],
  [1800, 0],
];

const MATE_SCORE = 100_000;
const MATE_ALWAYS_SEEN_ELO = 800;

const interpolate = (table: [number, number][], x: number): number => {
  if (x <= table[0][0]) return table[0][1];

  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (x <= x1) {
      const [x0, y0] = table[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }

  return table[table.length - 1][1];
};

export const clampElo = (elo: number): number =>
  Math.min(MAX_BOT_ELO, Math.max(MIN_BOT_ELO, Math.round(elo)));

export const clampDepth = (depth: number): number =>
  Math.min(MAX_BOT_DEPTH, Math.max(MIN_BOT_DEPTH, Math.round(depth)));

export const planMove = (
  strength: BotStrength,
  nativeEloSupported: boolean
): MovePlan => {
  if (strength.mode === "max") {
    return { kind: "best", depth: FULL_STRENGTH_DEPTH };
  }

  if (strength.mode === "depth") {
    return { kind: "best", depth: clampDepth(strength.depth) };
  }

  const elo = clampElo(strength.elo);

  if (nativeEloSupported && elo >= NATIVE_MIN_ELO) {
    return elo > NATIVE_MAX_ELO
      ? { kind: "best", depth: FULL_STRENGTH_DEPTH }
      : { kind: "native", elo, depth: FULL_STRENGTH_DEPTH };
  }

  const temperatureCp = interpolate(TEMPERATURE_BY_ELO, elo);
  const randomMoveChance = interpolate(RANDOM_MOVE_CHANCE_BY_ELO, elo);
  const depth = Math.round(interpolate(DEPTH_BY_ELO, elo));

  if (temperatureCp < 1 && randomMoveChance === 0) {
    return { kind: "best", depth };
  }

  return {
    kind: "sampled",
    depth,
    multiPv: SAMPLED_MULTI_PV,
    temperatureCp,
    randomMoveChance,
  };
};

export const scoreFromLine = (
  line: { cp?: number; mate?: number },
  turn: "w" | "b"
): number => {
  const sign = turn === "w" ? 1 : -1;

  if (line.mate !== undefined) {
    const mateScore = line.mate > 0 ? MATE_SCORE : -MATE_SCORE;
    return sign * (mateScore - Math.sign(line.mate) * Math.abs(line.mate));
  }

  return sign * (line.cp ?? 0);
};

export const pickSampledMove = (
  candidates: ScoredMove[],
  legalMoves: string[],
  plan: Extract<MovePlan, { kind: "sampled" }>,
  elo: number,
  random: () => number = Math.random
): string | undefined => {
  if (!legalMoves.length) return undefined;
  if (!candidates.length) {
    return legalMoves[Math.floor(random() * legalMoves.length)];
  }

  const sorted = [...candidates].sort((a, b) => b.cp - a.cp);
  const best = sorted[0];

  const seesMate = best.cp > MATE_SCORE / 2 && elo >= MATE_ALWAYS_SEEN_ELO;
  if (seesMate) return best.uci;

  if (random() < plan.randomMoveChance) {
    return legalMoves[Math.floor(random() * legalMoves.length)];
  }

  const weights = sorted.map(({ cp }) =>
    Math.exp(-Math.min(best.cp - cp, 2000) / plan.temperatureCp)
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  let threshold = random() * total;
  for (let i = 0; i < sorted.length; i++) {
    threshold -= weights[i];
    if (threshold <= 0) return sorted[i].uci;
  }

  return best.uci;
};

export const describeStrength = (
  strength: BotStrength,
  nativeEloSupported: boolean
): string => {
  const plan = planMove(strength, nativeEloSupported);

  switch (plan.kind) {
    case "native":
      return `Uses the engine's built-in strength limit (${plan.elo}).`;
    case "best":
      return strength.mode === "max"
        ? "Always plays its best move."
        : `Always plays its best move found at depth ${plan.depth}.`;
    case "sampled":
      return `Searches to depth ${plan.depth} and sometimes picks a weaker move on purpose, like a human would.`;
  }
};

export const maxDepthForTime = (
  remainingMs: number | undefined
): number | undefined => {
  if (remainingMs === undefined) return undefined;
  if (remainingMs < 3_000) return 3;
  if (remainingMs < 10_000) return 6;
  if (remainingMs < 30_000) return 10;
  return undefined;
};
