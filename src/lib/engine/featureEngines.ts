import { storedAtom } from "@/lib/storedAtom";
import { EngineName } from "@/types/enums";

/**
 * Every engine-driven feature picks its own engine. By default it is the
 * analysis engine, so nothing has to be chosen twice, but any engine can be
 * assigned to a feature: a strong one for threats, a light one for the coach.
 */
export type EngineFeature = "threats" | "coach" | "advice" | "evaluator";

export type EngineChoice = "analysis" | EngineName;

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
];

export const isEngineChoice = (value: unknown): value is EngineChoice =>
  value === "analysis" ||
  Object.values(EngineName).includes(value as EngineName);

export const resolveEngineChoice = (
  choice: EngineChoice,
  analysisEngine: EngineName
): EngineName => (choice === "analysis" ? analysisEngine : choice);

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
};
