import { EngineField } from "@/components/enginePicker";
import { engineLabel } from "@/constants";
import {
  ENGINE_FEATURES,
  ENGINE_INHERIT_LABELS,
  ENGINE_INHERIT_SOURCES,
  EngineInheritSource,
  featureEngineAtoms,
  isEngineInheritSource,
  resolveEngineChoice,
} from "@/lib/engine/featureEngines";
import { engineNameAtom } from "@/sections/analysis/states";
import { enginePlayNameAtom } from "@/sections/play/states";
import {
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useAtom, useAtomValue } from "jotai";

const SOURCE_DESCRIPTION: Record<EngineInheritSource, string> = {
  analysis: "Analysis & Editor engine",
  coach: "Coach · Move Grading engine",
  bot: "Bot opponent you are playing against",
};

/**
 * The engine one feature runs on: either inherited from another engine role
 * (which dims and locks the specific engine picker) or a custom engine choice.
 */
export default function FeatureEngineSelect({
  feature,
  label,
}: {
  feature: (typeof ENGINE_FEATURES)[number];
  label?: string;
}) {
  const [choice, setChoice] = useAtom(featureEngineAtoms[feature.id]);
  const analysisEngine = useAtomValue(engineNameAtom);
  const coachChoice = useAtomValue(featureEngineAtoms.coach);
  const botEngine = useAtomValue(enginePlayNameAtom);

  const sources = ENGINE_INHERIT_SOURCES[feature.id];
  const inheritSource = isEngineInheritSource(choice) ? choice : null;
  const resolved = resolveEngineChoice(choice, analysisEngine, {
    coachChoice,
    botEngine,
  });

  const handleModeChange = (
    _: unknown,
    next: "custom" | EngineInheritSource | null
  ) => {
    if (!next) return;
    if (next === "custom") {
      setChoice(resolved);
    } else {
      setChoice(next);
    }
  };

  const inheritedFallbackNote =
    inheritSource === "analysis" && resolved !== analysisEngine
      ? ` The analysis engine's scores are not real, so this falls back to ${engineLabel(resolved).small}.`
      : inheritSource === "bot" && resolved !== botEngine
        ? ` The current bot's scores are not real, so this falls back to ${engineLabel(resolved).small}.`
        : "";

  const helperText = inheritSource
    ? `Following the ${SOURCE_DESCRIPTION[inheritSource]}. Switch to Custom to pick a specific engine.${inheritedFallbackNote}`
    : feature.help;

  return (
    <Stack spacing={1.25}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        flexWrap="wrap"
      >
        <Typography variant="body2" fontWeight={600}>
          {label ?? feature.label}
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={inheritSource ?? "custom"}
          onChange={handleModeChange}
          aria-label={`${label ?? feature.label} source`}
          sx={{
            "& .MuiToggleButton-root": {
              py: 0.3,
              px: 1.15,
              fontSize: "0.75rem",
              textTransform: "none",
            },
          }}
        >
          <ToggleButton value="custom">Custom</ToggleButton>
          {sources.map((src) => (
            <ToggleButton key={src} value={src}>
              Same as {ENGINE_INHERIT_LABELS[src]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <EngineField
        label={inheritSource ? "Inherited engine" : "Selected engine"}
        role="feature"
        value={resolved}
        disabled={inheritSource !== null}
        inheritedText={
          inheritSource
            ? `${engineLabel(resolved).full} (from ${ENGINE_INHERIT_LABELS[inheritSource]})`
            : undefined
        }
        onChange={(next) => {
          if (next === "analysis") {
            setChoice("analysis");
          } else {
            setChoice(next);
          }
        }}
        helper={helperText}
      />
    </Stack>
  );
}
