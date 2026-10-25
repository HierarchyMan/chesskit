import {
  EngineFeature,
  featureEngineAtoms,
  resolveEngineChoice,
} from "@/lib/engine/featureEngines";
import { engineNameAtom } from "@/sections/analysis/states";
import { EngineId } from "@/types/enums";
import { useAtomValue } from "jotai";

/** The engine a feature runs on: its own choice, or the analysis engine. */
export const useFeatureEngineName = (feature: EngineFeature): EngineId => {
  const choice = useAtomValue(featureEngineAtoms[feature]);
  const analysisEngine = useAtomValue(engineNameAtom);
  return resolveEngineChoice(choice, analysisEngine);
};
