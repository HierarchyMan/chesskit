import { storedAtom } from "@/lib/storedAtom";
import {
  BotStrength,
  FULL_STRENGTH_DEPTH,
  MAX_BOT_ELO,
  planMove,
} from "./strength";

/**
 * Engine settings that apply to every engine, each clamped to what the engine
 * itself advertises (a browser build has one thread, for instance).
 */

const isIntegerBetween =
  (min: number, max: number) =>
  (value: unknown): value is number =>
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max;

export interface EngineRuntimeSettings {
  hashMb: number;
  threads: number;
}

// 16 MB is what the engines use when nobody sets it.
export const DEFAULT_HASH_MB = 16;
export const HASH_CHOICES = [16, 32, 64, 128, 256, 512, 1024];
export const engineHashMbAtom = storedAtom(
  "engine-hash-mb",
  DEFAULT_HASH_MB,
  isIntegerBetween(1, 4096)
);

// Only native engines (through the bridge) can use more than one thread.
export const MAX_NATIVE_THREADS = 64;
export const nativeThreadsAtom = storedAtom(
  "engine-native-threads",
  1,
  isIntegerBetween(1, MAX_NATIVE_THREADS)
);

// How long a bot thinks per move at full strength, when no clock limits it.
export const DEFAULT_FULL_STRENGTH_MS = 3000;
export const MIN_FULL_STRENGTH_MS = 1000;
export const MAX_FULL_STRENGTH_MS = 30_000;
export const fullStrengthMsAtom = storedAtom(
  "bot-full-strength-ms",
  DEFAULT_FULL_STRENGTH_MS,
  isIntegerBetween(MIN_FULL_STRENGTH_MS, MAX_FULL_STRENGTH_MS)
);

/**
 * The shortest a bot takes to reply, however fast its search is. "Natural"
 * keeps the short pause that makes the reply feel like an opponent; "instant"
 * is for players who want the move the moment the engine has it.
 */
export type BotReplySpeed = "instant" | "natural" | "slow";
export const BOT_REPLY_SPEEDS: readonly BotReplySpeed[] = [
  "instant",
  "natural",
  "slow",
];
export const BOT_REPLY_SPEED_LABELS: Record<BotReplySpeed, string> = {
  instant: "Instant",
  natural: "Natural",
  slow: "Slow",
};
export const DEFAULT_BOT_REPLY_SPEED: BotReplySpeed = "natural";
export const botReplySpeedAtom = storedAtom<BotReplySpeed>(
  "bot-reply-speed",
  DEFAULT_BOT_REPLY_SPEED,
  (value): value is BotReplySpeed =>
    typeof value === "string" &&
    (BOT_REPLY_SPEEDS as readonly string[]).includes(value)
);

/** The minimum think time in ms for a speed; `roll` is a 0..1 random number. */
export const botReplyDelayMs = (
  speed: BotReplySpeed,
  roll: number = Math.random()
): number => {
  switch (speed) {
    case "instant":
      return 0;
    case "slow":
      return Math.round(1200 + roll * 1300);
    default:
      return Math.round(350 + roll * 450);
  }
};

// How deep the advisor engine searches each move for the joke engines.
export const DEFAULT_ADVISOR_DEPTH = 10;
export const ADVISOR_DEPTH_RANGE = { min: 1, max: 20 } as const;
export const jokeAdvisorDepthAtom = storedAtom(
  "joke-advisor-depth",
  DEFAULT_ADVISOR_DEPTH,
  isIntegerBetween(ADVISOR_DEPTH_RANGE.min, ADVISOR_DEPTH_RANGE.max)
);

// How deep the bot evaluates a position when deciding whether to accept a draw offer.
export const DEFAULT_BOT_DRAW_EVAL_DEPTH = 12;
export const BOT_DRAW_EVAL_DEPTH_RANGE = { min: 4, max: 24 } as const;
export const botDrawEvalDepthAtom = storedAtom(
  "bot-draw-eval-depth",
  DEFAULT_BOT_DRAW_EVAL_DEPTH,
  isIntegerBetween(BOT_DRAW_EVAL_DEPTH_RANGE.min, BOT_DRAW_EVAL_DEPTH_RANGE.max)
);

// Play Coach — Move Grading (ArenaAnalysisSession in Play).
export const DEFAULT_COACH_GRADING_DEPTH = 12;
export const COACH_GRADING_DEPTH_RANGE = { min: 4, max: 24 } as const;
export const coachGradingDepthAtom = storedAtom(
  "coach-grading-depth",
  DEFAULT_COACH_GRADING_DEPTH,
  isIntegerBetween(COACH_GRADING_DEPTH_RANGE.min, COACH_GRADING_DEPTH_RANGE.max)
);

export const DEFAULT_COACH_GRADING_MULTIPV = 3;
export const COACH_GRADING_MULTIPV_RANGE = { min: 1, max: 6 } as const;
export const coachGradingMultiPvAtom = storedAtom(
  "coach-grading-multipv",
  DEFAULT_COACH_GRADING_MULTIPV,
  isIntegerBetween(
    COACH_GRADING_MULTIPV_RANGE.min,
    COACH_GRADING_MULTIPV_RANGE.max
  )
);

// Play Coach — Interactive Dialogue (Dr. Wolf / Coach David).
// When coachDialogueMovetimeMsAtom > 0, UCI runs `go movetime <ms>`.
// When coachDialogueMovetimeMsAtom === 0, UCI runs `go depth <depth>`.
export const DEFAULT_COACH_DIALOGUE_DEPTH = 7;
export const COACH_DIALOGUE_DEPTH_RANGE = { min: 4, max: 20 } as const;
export const coachDialogueDepthAtom = storedAtom(
  "coach-dialogue-depth",
  DEFAULT_COACH_DIALOGUE_DEPTH,
  isIntegerBetween(
    COACH_DIALOGUE_DEPTH_RANGE.min,
    COACH_DIALOGUE_DEPTH_RANGE.max
  )
);

export const DEFAULT_COACH_DIALOGUE_MULTIPV = 2;
export const COACH_DIALOGUE_MULTIPV_RANGE = { min: 1, max: 5 } as const;
export const coachDialogueMultiPvAtom = storedAtom(
  "coach-dialogue-multipv",
  DEFAULT_COACH_DIALOGUE_MULTIPV,
  isIntegerBetween(
    COACH_DIALOGUE_MULTIPV_RANGE.min,
    COACH_DIALOGUE_MULTIPV_RANGE.max
  )
);

export const DEFAULT_COACH_DIALOGUE_MOVETIME_MS = 180;
export const COACH_DIALOGUE_MOVETIME_RANGE = { min: 50, max: 3000 } as const;
export const isCoachDialogueMovetimeMs = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  (value === 0 ||
    (value >= COACH_DIALOGUE_MOVETIME_RANGE.min &&
      value <= COACH_DIALOGUE_MOVETIME_RANGE.max));

export const coachDialogueMovetimeMsAtom = storedAtom(
  "coach-dialogue-movetime-ms",
  DEFAULT_COACH_DIALOGUE_MOVETIME_MS,
  isCoachDialogueMovetimeMs
);

// Play Suggestions / Hints (advice feature).
export const DEFAULT_ADVICE_DEPTH = 14;
export const ADVICE_DEPTH_RANGE = { min: 6, max: 30 } as const;
export const adviceDepthAtom = storedAtom(
  "advice-depth",
  DEFAULT_ADVICE_DEPTH,
  isIntegerBetween(ADVICE_DEPTH_RANGE.min, ADVICE_DEPTH_RANGE.max)
);

export const DEFAULT_ADVICE_MULTIPV = 3;
export const ADVICE_MULTIPV_RANGE = { min: 1, max: 6 } as const;
export const adviceMultiPvAtom = storedAtom(
  "advice-multipv",
  DEFAULT_ADVICE_MULTIPV,
  isIntegerBetween(ADVICE_MULTIPV_RANGE.min, ADVICE_MULTIPV_RANGE.max)
);

// Engine Arena — Move Evaluation & Accuracy.
export const DEFAULT_ARENA_EVAL_DEPTH = 12;
export const ARENA_EVAL_DEPTH_RANGE = { min: 4, max: 24 } as const;
export const arenaEvalDepthAtom = storedAtom(
  "arena-eval-depth",
  DEFAULT_ARENA_EVAL_DEPTH,
  isIntegerBetween(ARENA_EVAL_DEPTH_RANGE.min, ARENA_EVAL_DEPTH_RANGE.max)
);

export const DEFAULT_ARENA_EVAL_MULTIPV = 3;
export const ARENA_EVAL_MULTIPV_RANGE = { min: 1, max: 6 } as const;
export const arenaEvalMultiPvAtom = storedAtom(
  "arena-eval-multipv",
  DEFAULT_ARENA_EVAL_MULTIPV,
  isIntegerBetween(ARENA_EVAL_MULTIPV_RANGE.min, ARENA_EVAL_MULTIPV_RANGE.max)
);

/**
 * Where a feature's search parameters (depth, MultiPV, time budget) come from:
 * either its own custom sliders or inherited live from another engine role.
 */
export type SettingsInheritMode = "custom" | "analysis" | "coach" | "bot";

const isOneOf =
  <T extends string>(allowed: readonly T[]) =>
  (value: unknown): value is T =>
    typeof value === "string" && (allowed as readonly string[]).includes(value);

export const COACH_GRADING_INHERIT_MODES = [
  "custom",
  "analysis",
  "bot",
] as const;
export type CoachGradingInheritMode =
  (typeof COACH_GRADING_INHERIT_MODES)[number];
export const coachGradingInheritAtom = storedAtom<CoachGradingInheritMode>(
  "coach-grading-inherit",
  "custom",
  isOneOf(COACH_GRADING_INHERIT_MODES)
);

export const COACH_DIALOGUE_INHERIT_MODES = [
  "custom",
  "analysis",
  "coach",
  "bot",
] as const;
export type CoachDialogueInheritMode =
  (typeof COACH_DIALOGUE_INHERIT_MODES)[number];
export const coachDialogueInheritAtom = storedAtom<CoachDialogueInheritMode>(
  "coach-dialogue-inherit",
  "custom",
  isOneOf(COACH_DIALOGUE_INHERIT_MODES)
);

export const ADVICE_INHERIT_MODES = ["custom", "analysis", "bot"] as const;
export type AdviceInheritMode = (typeof ADVICE_INHERIT_MODES)[number];
export const adviceInheritAtom = storedAtom<AdviceInheritMode>(
  "advice-inherit",
  "custom",
  isOneOf(ADVICE_INHERIT_MODES)
);

export const THREATS_INHERIT_MODES = ["custom", "analysis", "bot"] as const;
export type ThreatsInheritMode = (typeof THREATS_INHERIT_MODES)[number];
export const threatsInheritAtom = storedAtom<ThreatsInheritMode>(
  "threats-inherit",
  "custom",
  isOneOf(THREATS_INHERIT_MODES)
);

export const ARENA_EVAL_INHERIT_MODES = ["custom", "analysis"] as const;
export type ArenaEvalInheritMode = (typeof ARENA_EVAL_INHERIT_MODES)[number];
export const arenaEvalInheritAtom = storedAtom<ArenaEvalInheritMode>(
  "arena-eval-inherit",
  "custom",
  isOneOf(ARENA_EVAL_INHERIT_MODES)
);

export const BOT_DRAW_EVAL_INHERIT_MODES = [
  "custom",
  "analysis",
  "bot",
] as const;
export type BotDrawEvalInheritMode =
  (typeof BOT_DRAW_EVAL_INHERIT_MODES)[number];
export const botDrawEvalInheritAtom = storedAtom<BotDrawEvalInheritMode>(
  "bot-draw-eval-inherit",
  "custom",
  isOneOf(BOT_DRAW_EVAL_INHERIT_MODES)
);

export const JOKE_ADVISOR_INHERIT_MODES = ["custom", "analysis"] as const;
export type JokeAdvisorInheritMode =
  (typeof JOKE_ADVISOR_INHERIT_MODES)[number];
export const jokeAdvisorInheritAtom = storedAtom<JokeAdvisorInheritMode>(
  "joke-advisor-inherit",
  "custom",
  isOneOf(JOKE_ADVISOR_INHERIT_MODES)
);

const clampInt = (
  value: number,
  range: { readonly min: number; readonly max: number }
): number => Math.min(range.max, Math.max(range.min, Math.round(value)));

/** Derives effective search depth & optional movetime from the current Play bot strength. */
export const getBotEffectiveSearch = (
  botStrength: BotStrength,
  fullStrengthMs: number
): { depth: number; movetimeMs: number } => {
  if (botStrength.mode === "depth") {
    return {
      depth: clampInt(botStrength.depth, { min: 4, max: 30 }),
      movetimeMs: 0,
    };
  }
  if (botStrength.mode === "max") {
    return {
      depth: FULL_STRENGTH_DEPTH,
      movetimeMs: clampInt(fullStrengthMs, COACH_DIALOGUE_MOVETIME_RANGE),
    };
  }
  const plan = planMove(botStrength, {
    maxElo: MAX_BOT_ELO,
    fullStrengthMs,
  });
  const movetimeMs =
    plan.kind === "best" && plan.movetimeMs
      ? clampInt(plan.movetimeMs, COACH_DIALOGUE_MOVETIME_RANGE)
      : 0;
  return {
    depth: clampInt(plan.depth, { min: 4, max: 30 }),
    movetimeMs,
  };
};

export const resolveInheritedDepth = (
  mode: SettingsInheritMode,
  customDepth: number,
  range: { readonly min: number; readonly max: number },
  sources: {
    analysisDepth: number;
    botDepth?: number;
    coachDepth?: number;
  }
): number => {
  if (mode === "analysis") return clampInt(sources.analysisDepth, range);
  if (mode === "bot" && sources.botDepth !== undefined) {
    return clampInt(sources.botDepth, range);
  }
  if (mode === "coach" && sources.coachDepth !== undefined) {
    return clampInt(sources.coachDepth, range);
  }
  return clampInt(customDepth, range);
};

export const resolveInheritedMultiPv = (
  mode: SettingsInheritMode,
  customMultiPv: number,
  range: { readonly min: number; readonly max: number },
  sources: {
    analysisMultiPv: number;
    coachMultiPv?: number;
  }
): number => {
  if (mode === "analysis") return clampInt(sources.analysisMultiPv, range);
  if (mode === "coach" && sources.coachMultiPv !== undefined) {
    return clampInt(sources.coachMultiPv, range);
  }
  return clampInt(customMultiPv, range);
};

export const resolveCoachDialogueSearch = (
  mode: CoachDialogueInheritMode,
  custom: { depth: number; multiPv: number; movetimeMs: number },
  sources: {
    analysisDepth: number;
    analysisMultiPv: number;
    coachDepth: number;
    coachMultiPv: number;
    botDepth: number;
    botMovetimeMs: number;
  }
): { depth: number; multiPv: number; movetimeMs: number } => {
  if (mode === "custom") return custom;
  if (mode === "analysis") {
    return {
      depth: clampInt(sources.analysisDepth, COACH_DIALOGUE_DEPTH_RANGE),
      multiPv: clampInt(sources.analysisMultiPv, COACH_DIALOGUE_MULTIPV_RANGE),
      movetimeMs: 0,
    };
  }
  if (mode === "coach") {
    return {
      depth: clampInt(sources.coachDepth, COACH_DIALOGUE_DEPTH_RANGE),
      multiPv: clampInt(sources.coachMultiPv, COACH_DIALOGUE_MULTIPV_RANGE),
      movetimeMs: 0,
    };
  }
  return {
    depth: clampInt(sources.botDepth, COACH_DIALOGUE_DEPTH_RANGE),
    multiPv: clampInt(custom.multiPv, COACH_DIALOGUE_MULTIPV_RANGE),
    movetimeMs:
      sources.botMovetimeMs > 0
        ? clampInt(sources.botMovetimeMs, COACH_DIALOGUE_MOVETIME_RANGE)
        : 0,
  };
};

// Leaves one core for the browser and the rest of the computer.
export const recommendedNativeThreads = (): number =>
  typeof navigator === "undefined"
    ? 1
    : Math.max(
        1,
        Math.min(MAX_NATIVE_THREADS, (navigator.hardwareConcurrency || 2) - 1)
      );
