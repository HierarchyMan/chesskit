import { EngineField } from "@/components/enginePicker";
import {
  ENGINE_FEATURES,
  featureEngineAtoms,
  resolveEngineChoice,
} from "@/lib/engine/featureEngines";
import { engineLabel } from "@/constants";
import { engineNameAtom } from "@/sections/analysis/states";
import { useAtom, useAtomValue } from "jotai";

/** The engine one feature runs on: the analysis engine unless another is chosen. */
export default function FeatureEngineSelect({
  feature,
}: {
  feature: (typeof ENGINE_FEATURES)[number];
}) {
  const [choice, setChoice] = useAtom(featureEngineAtoms[feature.id]);
  const analysisEngine = useAtomValue(engineNameAtom);
  const resolved = resolveEngineChoice("analysis", analysisEngine);

  return (
    <EngineField
      label={feature.label}
      role="feature"
      value={choice}
      onChange={setChoice}
      inherit={resolved}
      helper={
        resolved !== analysisEngine
          ? `${feature.help} The analysis engine's evaluations are not real, so this uses ${engineLabel(resolved).small} until you pick one.`
          : feature.help
      }
    />
  );
}
