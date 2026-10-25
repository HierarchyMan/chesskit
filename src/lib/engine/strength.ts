export type StrengthMode = "elo" | "depth" | "max";

export interface BotStrength {
  mode: StrengthMode;
  elo: number;
  depth: number;
}

export type MovePlan =
  | { kind: "native"; elo: number; depth: number }
  // With movetimeMs the engine thinks for that long; depth is then only a fallback.
  | { kind: "best"; depth: number; movetimeMs?: number }
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
// The slider's top when an engine's rating is unknown. Rated engines reach their own rating.
export const MAX_BOT_ELO = 3200;
export const NATIVE_MIN_ELO = 1320;
export const NATIVE_MAX_ELO = 3190;
// Deepest fixed search the Elo emulation uses just below an engine's full strength.
export const MAX_EMULATED_DEPTH = 24;

/** What a bot's strength can use on one engine. */
export interface StrengthProfile {
  // The engine's own UCI_Elo range, when it has one.
  nativeElo?: { min: number; max: number };
  // The engine's rating: the top of the Elo slider, which means full strength.
  maxElo: number;
  // Think time per move at full strength.
  fullStrengthMs: number;
}

export const DEFAULT_STRENGTH_PROFILE: StrengthProfile = {
  nativeElo: { min: NATIVE_MIN_ELO, max: NATIVE_MAX_ELO },
  maxElo: MAX_BOT_ELO,
  fullStrengthMs: 3000,
};
export const MIN_BOT_DEPTH = 1;
export const MAX_BOT_DEPTH = 30;
export const FULL_STRENGTH_DEPTH = 16;
export const SAMPLED_MULTI_PV = 5;

export const DEFAULT_STRENGTH: BotStrength = {
  mode: "elo",
  elo: 1500,
  depth: 8,
};

export const CHALLENGE_STRENGTH: BotStrength = {
  mode: "max",
  elo: MAX_BOT_ELO,
  depth: FULL_STRENGTH_DEPTH,
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

export const clampElo = (elo: number, maxElo = MAX_BOT_ELO): number =>
  Math.min(maxElo, Math.max(MIN_BOT_ELO, Math.round(elo)));

// The emulation's depth table, ending at the engine's own rating.
const depthTableFor = (maxElo: number): [number, number][] => [
  ...DEPTH_BY_ELO.filter(([elo]) => elo < maxElo),
  [maxElo, MAX_EMULATED_DEPTH],
];

export const clampDepth = (depth: number): number =>
  Math.min(MAX_BOT_DEPTH, Math.max(MIN_BOT_DEPTH, Math.round(depth)));

export const planMove = (
  strength: BotStrength,
  profile: StrengthProfile = DEFAULT_STRENGTH_PROFILE
): MovePlan => {
  const full: MovePlan = {
    kind: "best",
    depth: MAX_BOT_DEPTH,
    movetimeMs: profile.fullStrengthMs,
  };

  if (strength.mode === "max") return full;

  if (strength.mode === "depth") {
    return { kind: "best", depth: clampDepth(strength.depth) };
  }

  const elo = clampElo(strength.elo, profile.maxElo);
  // The top of the slider is the engine's rating, which it reaches only at full strength.
  if (elo >= profile.maxElo) return full;

  const native = profile.nativeElo;
  if (native && elo >= native.min && elo <= native.max) {
    return { kind: "native", elo, depth: FULL_STRENGTH_DEPTH };
  }

  const temperatureCp = interpolate(TEMPERATURE_BY_ELO, elo);
  const randomMoveChance = interpolate(RANDOM_MOVE_CHANCE_BY_ELO, elo);
  const depth = Math.round(interpolate(depthTableFor(profile.maxElo), elo));

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

const formatSeconds = (ms: number): string =>
  `${Number((ms / 1000).toFixed(1))} s`;

export const describeStrength = (
  strength: BotStrength,
  profile: StrengthProfile = DEFAULT_STRENGTH_PROFILE
): string => {
  const plan = planMove(strength, profile);

  switch (plan.kind) {
    case "native":
      return `Uses the engine's built-in strength limit (${plan.elo}).`;
    case "best":
      return plan.movetimeMs
        ? `Full strength: thinks ${formatSeconds(plan.movetimeMs)} per move and plays its best move. A game clock can make it move sooner.`
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

// A clocked bot spends at most about a thirtieth of its remaining time on one move.
export const maxMovetimeForClock = (
  remainingMs: number | undefined
): number | undefined =>
  remainingMs === undefined
    ? undefined
    : Math.max(100, Math.round(remainingMs / 30));
