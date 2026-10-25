import { fullStrengthMsAtom } from "@/lib/engine/engineSettings";
import { engineMaxElo, getEngineModel } from "@/lib/engine/models";
import {
  BotStrength,
  MAX_BOT_DEPTH,
  MIN_BOT_DEPTH,
  MIN_BOT_ELO,
  STRENGTH_PRESETS,
  StrengthMode,
  describeStrength,
} from "@/lib/engine/strength";
import { EngineId } from "@/types/enums";
import {
  Alert,
  Box,
  Chip,
  Link,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useAtomValue } from "jotai";
import { useState } from "react";
import MaxStrengthGuide from "./maxStrengthGuide";

interface Props {
  value: BotStrength;
  onChange: (value: BotStrength) => void;
  engineName: EngineId;
}

export default function StrengthControl({
  value,
  onChange,
  engineName,
}: Props) {
  const model = getEngineModel(engineName);
  const fullStrengthMs = useAtomValue(fullStrengthMsAtom);
  const [guideOpen, setGuideOpen] = useState(false);
  const maxElo = engineMaxElo(engineName);
  const profile = { nativeElo: model.nativeElo, maxElo, fullStrengthMs };
  const presets = STRENGTH_PRESETS.filter((preset) => preset.elo < maxElo);
  const marks = [
    ...presets.map(({ elo }) => ({ value: elo })),
    { value: maxElo, label: "Full" },
  ];
  const elo = Math.min(value.elo, maxElo);

  if (model.playsOwnMoves) {
    return (
      <Alert severity="info" variant="outlined">
        {model.label.small} plays its own way, so strength settings do not
        apply.
      </Alert>
    );
  }

  return (
    <Stack spacing={1.5}>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={value.mode}
        onChange={(_, mode: StrengthMode | null) => {
          if (mode) onChange({ ...value, mode });
        }}
        aria-label="Strength mode"
      >
        <ToggleButton value="elo">Elo</ToggleButton>
        <ToggleButton value="depth">Fixed depth</ToggleButton>
        <ToggleButton value="max">Full strength</ToggleButton>
      </ToggleButtonGroup>

      {value.mode === "elo" && (
        <>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {presets.map((preset) => (
              <Chip
                key={preset.label}
                size="small"
                label={`${preset.label} ${preset.elo}`}
                color={elo === preset.elo ? "primary" : "default"}
                variant={elo === preset.elo ? "filled" : "outlined"}
                onClick={() => onChange({ ...value, elo: preset.elo })}
              />
            ))}
            <Chip
              size="small"
              label={`Full ${maxElo}`}
              color={elo >= maxElo ? "primary" : "default"}
              variant={elo >= maxElo ? "filled" : "outlined"}
              onClick={() => onChange({ ...value, elo: maxElo })}
            />
          </Stack>

          <Box px={1}>
            <Slider
              value={elo}
              min={MIN_BOT_ELO}
              max={maxElo}
              step={10}
              marks={marks}
              valueLabelDisplay="on"
              onChange={(_, next) =>
                onChange({ ...value, elo: next as number })
              }
              aria-label="Bot Elo"
              sx={{ mt: 3 }}
            />
          </Box>
        </>
      )}

      {value.mode === "depth" && (
        <Box px={1}>
          <Slider
            value={value.depth}
            min={MIN_BOT_DEPTH}
            max={MAX_BOT_DEPTH}
            step={1}
            valueLabelDisplay="on"
            onChange={(_, depth) =>
              onChange({ ...value, depth: depth as number })
            }
            aria-label="Search depth"
            sx={{ mt: 3 }}
          />
        </Box>
      )}

      <Typography variant="body2" sx={{ opacity: 0.75 }}>
        {describeStrength({ ...value, elo }, profile)}
        {value.mode === "elo" &&
          (model.rating
            ? ` The top of the slider is ${model.label.small}'s own rating (${model.rating.source === "ccrl" ? "CCRL Blitz" : "its author's estimate"}), measured against other engines on a native build, so it is not a human rating.`
            : " This engine has no published rating, so the slider tops out at 3200, where it plays at full strength.")}{" "}
        <Link
          component="button"
          type="button"
          variant="body2"
          onClick={() => setGuideOpen(true)}
          sx={{ verticalAlign: "baseline" }}
        >
          How to get maximum strength
        </Link>
      </Typography>

      <MaxStrengthGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </Stack>
  );
}
