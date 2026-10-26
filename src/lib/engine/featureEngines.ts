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
  | "advice"
  | "evaluator"
  | "jokes";

export type EngineChoice = "analysis" | EngineId;

export const ENGINE_FEATURES: {
  id: EngineFeature;
  label: string;
  help: string;
}[] = [
  {
    id: "threats",
    label: "Threats",
    help: "Finds what the opponent would do if it were their move, in Analysis and Play.",
  },
  {
    id: "advice",
    label: "Play suggestions",
    help: "Hints and the engine's moves on the board while you play a bot.",
  },
  {
    id: "coach",
    label: "Play coach",
    help: "Grades each move you make against a bot.",
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
  value === "analysis" || isReliableEngineId(value);

/**
 * The engine a feature runs on. Features that grade moves need real
 * evaluations, so when the analysis engine is a joke engine (or any engine
 * whose scores are not real) they use the default engine instead.
 */
export const resolveEngineChoice = (
  choice: EngineChoice,
  analysisEngine: EngineId
): EngineId => {
  if (choice !== "analysis") return choice;
  return isReliableEngineId(analysisEngine) ? analysisEngine : DEFAULT_ENGINE;
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
