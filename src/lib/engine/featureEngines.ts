import { storedAtom } from "@/lib/storedAtom";
import { EngineId } from "@/types/enums";
import { DEFAULT_ENGINE } from "@/constants";
import { isReliableEngineId } from "./models";

/**
 * Every engine-driven feature picks its own engine. By default it is the
 * analysis engine, so nothing has to be chosen twice, but any engine can be
 * assigned to a feature: a strong one for threats, a light one for the coach.
 */
export type EngineFeature =
  | "threats"
  | "coach"
  | "coachDialogue"
  | "advice"
  | "evaluator"
  | "jokes";

export type EngineInheritSource = "analysis" | "coach" | "bot";
export type EngineChoice = EngineInheritSource | EngineId;

export const ENGINE_INHERIT_SOURCES: Record<
  EngineFeature,
  readonly EngineInheritSource[]
> = {
  coach: ["analysis", "bot"],
  coachDialogue: ["analysis", "coach", "bot"],
  advice: ["analysis", "bot"],
  threats: ["analysis", "bot"],
  evaluator: ["analysis"],
  jokes: ["analysis"],
};

export const ENGINE_INHERIT_LABELS: Record<EngineInheritSource, string> = {
  analysis: "Analysis",
  coach: "Coach",
  bot: "Bot",
};

export const isEngineInheritSource = (
  value: unknown
): value is EngineInheritSource =>
  value === "analysis" || value === "coach" || value === "bot";

export const ENGINE_FEATURES: {
  id: EngineFeature;
  label: string;
  help: string;
}[] = [
  {
    id: "coach",
    label: "Play coach (grading)",
    help: "Grades each move you make against a bot and drives the live evaluation bar.",
  },
  {
    id: "coachDialogue",
    label: "Play coach (dialogue)",
    help: "Evaluates positions for Coach David's real-time commentary, warnings, and hints.",
  },
  {
    id: "advice",
    label: "Play suggestions",
    help: "Hints and the engine's moves on the board while you play a bot.",
  },
  {
    id: "threats",
    label: "Threats",
    help: "Finds what the opponent would do if it were their move, in Analysis and Play.",
  },
  {
    id: "evaluator",
    label: "Arena evaluation",
    help: "Scores and grades the moves in the Engine Arena.",
  },
  {
    id: "jokes",
    label: "Joke engines' advisor",
    help: "The real engine that Drawfish, Worstfish, Pacifist and Bongcloud ask to score every move.",
  },
];

export const engineFeatureLabel = (feature: EngineFeature): string =>
  ENGINE_FEATURES.find((entry) => entry.id === feature)?.label ?? feature;

export const isEngineChoice = (value: unknown): value is EngineChoice =>
  isEngineInheritSource(value) || isReliableEngineId(value);

export interface EngineResolveContext {
  coachChoice?: EngineChoice;
  botEngine?: EngineId;
}

/**
 * The engine a feature runs on. Features that grade moves need real
 * evaluations, so when an inherited source is a joke engine (or any engine
 * whose scores are not real) they fall back to a reliable engine instead.
 */
export const resolveEngineChoice = (
  choice: EngineChoice,
  analysisEngine: EngineId,
  context?: EngineResolveContext
): EngineId => {
  const safeAnalysis = isReliableEngineId(analysisEngine)
    ? analysisEngine
    : DEFAULT_ENGINE;

  if (choice === "analysis") return safeAnalysis;
  if (choice === "bot") {
    const bot = context?.botEngine;
    return bot && isReliableEngineId(bot) ? bot : safeAnalysis;
  }
  if (choice === "coach") {
    const coachChoice = context?.coachChoice;
    if (!coachChoice || coachChoice === "coach") return safeAnalysis;
    return resolveEngineChoice(coachChoice, analysisEngine, {
      botEngine: context?.botEngine,
    });
  }
  return choice;
};

export const featureEngineAtoms = {
  threats: storedAtom<EngineChoice>(
    "engine-for-threats",
    "analysis",
    isEngineChoice
  ),
  advice: storedAtom<EngineChoice>(
    "engine-for-advice",
    "analysis",
    isEngineChoice
  ),
  coach: storedAtom<EngineChoice>(
    "engine-for-coach",
    "analysis",
    isEngineChoice
  ),
  coachDialogue: storedAtom<EngineChoice>(
    "engine-for-coach-dialogue",
    "analysis",
    isEngineChoice
  ),
  evaluator: storedAtom<EngineChoice>(
    "engine-for-evaluator",
    "analysis",
    isEngineChoice
  ),
  jokes: storedAtom<EngineChoice>(
    "engine-for-jokes",
    "analysis",
    isEngineChoice
  ),
};
