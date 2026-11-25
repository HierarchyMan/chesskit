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
  const marks = presets.map(({ elo }) => ({ value: elo }));
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
        <Stack spacing={1}>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {presets.map((preset) => (
              <Chip
                key={preset.label}
                size="small"
                label={`${preset.label} ${preset.elo}`}
                color={elo === preset.elo ? "primary" : "default"}
                variant={elo === preset.elo ? "filled" : "outlined"}
                onClick={() => onChange({ ...value, elo: preset.elo })}
                sx={{ fontVariantNumeric: "tabular-nums" }}
              />
            ))}
          </Stack>

          <Box px={0.5}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              mb={0.25}
            >
              <Typography variant="caption" color="text.secondary">
                Target rating
              </Typography>
              <Typography
                variant="caption"
                fontWeight={700}
                sx={{
                  fontVariantNumeric: "tabular-nums",
                  px: 0.75,
                  py: 0.15,
                  borderRadius: 1,
                  bgcolor: "action.hover",
                }}
              >
                {elo} Elo
              </Typography>
            </Stack>
            <Slider
              value={elo}
              min={MIN_BOT_ELO}
              max={maxElo}
              step={10}
              marks={marks}
              valueLabelDisplay="auto"
              onChange={(_, next) =>
                onChange({ ...value, elo: next as number })
              }
              aria-label="Bot Elo"
            />
          </Box>
        </Stack>
      )}

      {value.mode === "depth" && (
        <Box px={0.5}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            mb={0.25}
          >
            <Typography variant="caption" color="text.secondary">
              Search depth
            </Typography>
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{
                fontVariantNumeric: "tabular-nums",
                px: 0.75,
                py: 0.15,
                borderRadius: 1,
                bgcolor: "action.hover",
              }}
            >
              Depth {value.depth}
            </Typography>
          </Stack>
          <Slider
            value={value.depth}
            min={MIN_BOT_DEPTH}
            max={MAX_BOT_DEPTH}
            step={1}
            valueLabelDisplay="auto"
            onChange={(_, depth) =>
              onChange({ ...value, depth: depth as number })
            }
            aria-label="Search depth"
          />
        </Box>
      )}

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", lineHeight: 1.45 }}
      >
        {describeStrength({ ...value, elo }, profile)}
        {value.mode === "elo" &&
          (model.rating
            ? ` (${model.rating.source === "ccrl" ? "CCRL" : "engine"} scale, not human Elo).`
            : " (uncalibrated engine scale).")}{" "}
        <Link
          component="button"
          type="button"
          variant="caption"
          onClick={() => setGuideOpen(true)}
          sx={{ verticalAlign: "baseline" }}
        >
          Max strength tips
        </Link>
      </Typography>

      <MaxStrengthGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </Stack>
  );
}
