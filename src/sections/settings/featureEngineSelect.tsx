import ModelMenuLabel from "@/components/modelMenuLabel";
import { ENGINE_LABELS } from "@/constants";
import { useModels } from "@/hooks/useModels";
import {
  ENGINE_FEATURES,
  EngineChoice,
  featureEngineAtoms,
} from "@/lib/engine/featureEngines";
import { engineNameAtom } from "@/sections/analysis/states";
import { EngineName } from "@/types/enums";
import {
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Typography,
} from "@mui/material";
import { useAtom, useAtomValue } from "jotai";

/** The engine one feature runs on: the analysis engine unless another is chosen. */
export default function FeatureEngineSelect({
  feature,
}: {
  feature: (typeof ENGINE_FEATURES)[number];
}) {
  const [choice, setChoice] = useAtom(featureEngineAtoms[feature.id]);
  const analysisEngine = useAtomValue(engineNameAtom);
  const { models, refresh } = useModels();
  const labelId = `engine-for-${feature.id}`;

  return (
    <FormControl fullWidth size="small">
      <InputLabel id={labelId}>{feature.label}</InputLabel>
      <Select
        labelId={labelId}
        input={<OutlinedInput label={feature.label} />}
        value={choice}
        onOpen={() => refresh()}
        onChange={(event) => setChoice(event.target.value as EngineChoice)}
        renderValue={(value) =>
          value === "analysis"
            ? `Same as analysis (${ENGINE_LABELS[analysisEngine].small})`
            : ENGINE_LABELS[value as EngineName].full
        }
      >
        <MenuItem value="analysis">Same as the analysis engine</MenuItem>
        {models.map((view) => (
          <MenuItem
            key={view.model.name}
            value={view.model.name}
            disabled={!view.supported}
          >
            <ModelMenuLabel view={view} />
          </MenuItem>
        ))}
      </Select>
      <Typography variant="caption" sx={{ opacity: 0.7, mt: 0.5 }}>
        {feature.help}
      </Typography>
    </FormControl>
  );
}
