import { ARROW_TUNING_DEFAULTS, THREAT_DEPTH_RANGE } from "@/lib/arrows/tuning";
import {
  ADVICE_DEPTH_RANGE,
  ADVICE_MULTIPV_RANGE,
  ARENA_EVAL_DEPTH_RANGE,
  ARENA_EVAL_MULTIPV_RANGE,
  BOT_DRAW_EVAL_DEPTH_RANGE,
  COACH_DIALOGUE_DEPTH_RANGE,
  COACH_DIALOGUE_MOVETIME_RANGE,
  COACH_DIALOGUE_MULTIPV_RANGE,
  COACH_GRADING_DEPTH_RANGE,
  COACH_GRADING_MULTIPV_RANGE,
  DEFAULT_ADVICE_DEPTH,
  DEFAULT_ADVICE_MULTIPV,
  DEFAULT_ARENA_EVAL_DEPTH,
  DEFAULT_ARENA_EVAL_MULTIPV,
  DEFAULT_BOT_DRAW_EVAL_DEPTH,
  DEFAULT_COACH_DIALOGUE_DEPTH,
  DEFAULT_COACH_DIALOGUE_MOVETIME_MS,
  DEFAULT_COACH_DIALOGUE_MULTIPV,
  DEFAULT_COACH_GRADING_DEPTH,
  DEFAULT_COACH_GRADING_MULTIPV,
} from "./engineSettings";

/**
 * Three quick presets for the search effort of every engine role. A preset
 * only writes the stored depth / MultiPV / time values; it never touches the
 * inherit modes, so a role that follows another role keeps following it.
 */
export type EnginePresetId = "fast" | "balanced" | "deep";
export type EnginePresetMatch = EnginePresetId | "custom";

export const ENGINE_PRESET_IDS: readonly EnginePresetId[] = [
  "fast",
  "balanced",
  "deep",
];

/** The values of every persisted atom a preset writes. */
export interface EnginePresetValues {
  /** `engineDepthAtom` (Analysis & Editor). */
  analysisDepth: number;
  /** `engineMultiPvAtom` (Analysis & Editor). */
  analysisMultiPv: number;
  /** `coachGradingDepthAtom`. */
  coachGradingDepth: number;
  /** `coachGradingMultiPvAtom`. */
  coachGradingMultiPv: number;
  /** `coachDialogueDepthAtom`. */
  coachDialogueDepth: number;
  /** `coachDialogueMultiPvAtom`. */
  coachDialogueMultiPv: number;
  /** `coachDialogueMovetimeMsAtom` (always a time budget, never 0). */
  coachDialogueMovetimeMs: number;
  /** `adviceDepthAtom`. */
  adviceDepth: number;
  /** `adviceMultiPvAtom`. */
  adviceMultiPv: number;
  /** `arrowTuningAtom.threatDepth`. */
  threatDepth: number;
  /** `arenaEvalDepthAtom`. */
  arenaEvalDepth: number;
  /** `arenaEvalMultiPvAtom`. */
  arenaEvalMultiPv: number;
  /** `botDrawEvalDepthAtom`. */
  botDrawEvalDepth: number;
}

type Range = { readonly min: number; readonly max: number };

// The Analysis atoms are declared in sections/analysis/states.ts, which pulls
// in the whole analysis state, so their slider bounds and defaults are
// mirrored here (depth 6-30 default 14, MultiPV 2-6 default 3).
export const ANALYSIS_DEPTH_RANGE: Range = { min: 6, max: 30 };
export const ANALYSIS_MULTIPV_RANGE: Range = { min: 2, max: 6 };
export const DEFAULT_ANALYSIS_DEPTH = 14;
export const DEFAULT_ANALYSIS_MULTIPV = 3;

/** The range each preset value must stay inside. */
export const ENGINE_PRESET_RANGES: Record<keyof EnginePresetValues, Range> = {
  analysisDepth: ANALYSIS_DEPTH_RANGE,
  analysisMultiPv: ANALYSIS_MULTIPV_RANGE,
  coachGradingDepth: COACH_GRADING_DEPTH_RANGE,
  coachGradingMultiPv: COACH_GRADING_MULTIPV_RANGE,
  coachDialogueDepth: COACH_DIALOGUE_DEPTH_RANGE,
  coachDialogueMultiPv: COACH_DIALOGUE_MULTIPV_RANGE,
  coachDialogueMovetimeMs: COACH_DIALOGUE_MOVETIME_RANGE,
  adviceDepth: ADVICE_DEPTH_RANGE,
  adviceMultiPv: ADVICE_MULTIPV_RANGE,
  threatDepth: THREAT_DEPTH_RANGE,
  arenaEvalDepth: ARENA_EVAL_DEPTH_RANGE,
  arenaEvalMultiPv: ARENA_EVAL_MULTIPV_RANGE,
  botDrawEvalDepth: BOT_DRAW_EVAL_DEPTH_RANGE,
};

export const ENGINE_PRESET_KEYS = Object.keys(
  ENGINE_PRESET_RANGES
) as (keyof EnginePresetValues)[];

export const ENGINE_PRESETS: Record<EnginePresetId, EnginePresetValues> = {
  // Quick answers: shallow searches and fewer lines everywhere.
  fast: {
    analysisDepth: 10,
    analysisMultiPv: 2,
    coachGradingDepth: 8,
    coachGradingMultiPv: 2,
    coachDialogueDepth: 5,
    coachDialogueMultiPv: 1,
    coachDialogueMovetimeMs: 100,
    adviceDepth: 10,
    adviceMultiPv: 2,
    threatDepth: 8,
    arenaEvalDepth: 8,
    arenaEvalMultiPv: 2,
    botDrawEvalDepth: 8,
  },
  // The app's own defaults.
  balanced: {
    analysisDepth: DEFAULT_ANALYSIS_DEPTH,
    analysisMultiPv: DEFAULT_ANALYSIS_MULTIPV,
    coachGradingDepth: DEFAULT_COACH_GRADING_DEPTH,
    coachGradingMultiPv: DEFAULT_COACH_GRADING_MULTIPV,
    coachDialogueDepth: DEFAULT_COACH_DIALOGUE_DEPTH,
    coachDialogueMultiPv: DEFAULT_COACH_DIALOGUE_MULTIPV,
    coachDialogueMovetimeMs: DEFAULT_COACH_DIALOGUE_MOVETIME_MS,
    adviceDepth: DEFAULT_ADVICE_DEPTH,
    adviceMultiPv: DEFAULT_ADVICE_MULTIPV,
    threatDepth: ARROW_TUNING_DEFAULTS.threatDepth,
    arenaEvalDepth: DEFAULT_ARENA_EVAL_DEPTH,
    arenaEvalMultiPv: DEFAULT_ARENA_EVAL_MULTIPV,
    botDrawEvalDepth: DEFAULT_BOT_DRAW_EVAL_DEPTH,
  },
  // Sharper verdicts: deeper searches and more lines, slower to arrive.
  deep: {
    analysisDepth: 20,
    analysisMultiPv: 4,
    coachGradingDepth: 18,
    coachGradingMultiPv: 4,
    coachDialogueDepth: 10,
    coachDialogueMultiPv: 3,
    coachDialogueMovetimeMs: 400,
    adviceDepth: 20,
    adviceMultiPv: 4,
    threatDepth: 16,
    arenaEvalDepth: 18,
    arenaEvalMultiPv: 4,
    botDrawEvalDepth: 18,
  },
};

export const ENGINE_PRESET_LABELS: Record<EnginePresetId, string> = {
  fast: "Fast",
  balanced: "Balanced",
  deep: "Deep",
};

/** One line on the speed versus depth tradeoff of each preset. */
export const ENGINE_PRESET_DESCRIPTIONS: Record<EnginePresetId, string> = {
  fast: "Quick replies and grades; shallower searches can miss subtle mistakes.",
  balanced: "The app's defaults: a good mix of speed and accuracy.",
  deep: "Sharper analysis and grading; results take noticeably longer.",
};

/** Which preset the current values match exactly, or "custom". */
export const matchEnginePreset = (
  current: EnginePresetValues
): EnginePresetMatch =>
  ENGINE_PRESET_IDS.find((id) =>
    ENGINE_PRESET_KEYS.every((key) => ENGINE_PRESETS[id][key] === current[key])
  ) ?? "custom";
