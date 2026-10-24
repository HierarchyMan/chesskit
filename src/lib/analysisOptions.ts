import { storedAtom } from "@/lib/storedAtom";

/**
 * The two switches shared by the Analysis page and the Engine Arena. Each
 * mode supplies its own storage keys and defaults, so the two can differ
 * without a second copy of the switch logic.
 */
export const ANALYSIS_OPTIONS = ["evaluation", "annotations"] as const;

export type AnalysisOption = (typeof ANALYSIS_OPTIONS)[number];
export type AnalysisOptionValues = Record<AnalysisOption, boolean>;
export type AnalysisOptionKeys = Record<AnalysisOption, string>;

const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

export const createAnalysisOptionAtoms = (
  keys: AnalysisOptionKeys,
  defaults: AnalysisOptionValues
) => ({
  evaluation: storedAtom(keys.evaluation, defaults.evaluation, isBoolean),
  annotations: storedAtom(keys.annotations, defaults.annotations, isBoolean),
});

export type AnalysisOptionAtoms = ReturnType<typeof createAnalysisOptionAtoms>;
