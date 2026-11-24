import {
  EngineFeature,
  featureEngineAtoms,
  resolveEngineChoice,
} from "@/lib/engine/featureEngines";
import { engineNameAtom } from "@/sections/analysis/states";
import { enginePlayNameAtom } from "@/sections/play/states";
import { EngineId } from "@/types/enums";
import { useAtomValue } from "jotai";

/** The engine a feature runs on: its own choice, or an inherited engine source. */
export const useFeatureEngineName = (feature: EngineFeature): EngineId => {
  const choice = useAtomValue(featureEngineAtoms[feature]);
  const analysisEngine = useAtomValue(engineNameAtom);
  const coachChoice = useAtomValue(featureEngineAtoms.coach);
  const botEngine = useAtomValue(enginePlayNameAtom);
  return resolveEngineChoice(choice, analysisEngine, {
    coachChoice,
    botEngine,
  });
};
