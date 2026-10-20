import { hasNativeEloLimit } from "@/constants";
import {
  BotStrength,
  MAX_BOT_DEPTH,
  MAX_BOT_ELO,
  MIN_BOT_DEPTH,
  MIN_BOT_ELO,
  STRENGTH_PRESETS,
  StrengthMode,
  describeStrength,
} from "@/lib/engine/strength";
import { EngineName } from "@/types/enums";
import {
  Box,
  Chip,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

interface Props {
  value: BotStrength;
  onChange: (value: BotStrength) => void;
  engineName: EngineName;
}

const MARKS = STRENGTH_PRESETS.map(({ elo }) => ({ value: elo }));

export default function StrengthControl({
  value,
  onChange,
  engineName,
}: Props) {
  const nativeSupported = hasNativeEloLimit(engineName);

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
            {STRENGTH_PRESETS.map((preset) => (
              <Chip
                key={preset.label}
                size="small"
                label={`${preset.label} ${preset.elo}`}
                color={value.elo === preset.elo ? "primary" : "default"}
                variant={value.elo === preset.elo ? "filled" : "outlined"}
                onClick={() => onChange({ ...value, elo: preset.elo })}
              />
            ))}
          </Stack>

          <Box px={1}>
            <Slider
              value={value.elo}
              min={MIN_BOT_ELO}
              max={MAX_BOT_ELO}
              step={50}
              marks={MARKS}
              valueLabelDisplay="on"
              onChange={(_, elo) => onChange({ ...value, elo: elo as number })}
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
        {describeStrength(value, nativeSupported)}
        {value.mode === "elo" &&
          " Engine Elo is an estimate against other engines, so it won't match your Lichess or Chess.com rating exactly."}
      </Typography>
    </Stack>
  );
}
