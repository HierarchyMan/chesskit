import Slider from "@/components/slider";
import {
  ARROW_TUNING_DEFAULTS,
  ArrowTuning,
  MISSED_FROM_LABELS,
  MissedFrom,
  SETTLE_DEPTH_RANGE,
  THREATS_SHOWN_RANGE,
  THREAT_DEPTH_RANGE,
  THREAT_SENSITIVITY_LABELS,
  ThreatSensitivity,
} from "@/lib/arrows/tuning";
import { arrowTuningAtom } from "@/lib/arrows/tuningAtom";
import {
  Button,
  FormControl,
  Grid2 as Grid,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useAtom } from "jotai";

export default function ArrowsTab() {
  const [tuning, setTuning] = useAtom(arrowTuningAtom);
  const update = (change: Partial<ArrowTuning>) =>
    setTuning((current) => ({ ...current, ...change }));

  return (
    <Grid container spacing={3} alignItems="flex-start">
      <Grid size={12}>
        <Typography variant="caption" sx={{ opacity: 0.75 }}>
          Which arrows to show, and how many, is set on the board under it. Here
          you set how they decide. Each feature&apos;s engine is chosen in the
          Engine tab.
        </Typography>
      </Grid>

      <Slider
        label="Wait for search depth"
        value={tuning.settleDepth}
        setValue={(settleDepth) => update({ settleDepth })}
        min={SETTLE_DEPTH_RANGE.min}
        max={SETTLE_DEPTH_RANGE.max}
        marksFilter={2}
        infoContent={
          <>
            The first lines of a search jump between moves. Arrows wait until
            the search has reached this depth. A lower value shows arrows
            sooner, a higher one shows steadier arrows.
          </>
        }
      />

      <Grid size={12}>
        <FormControl fullWidth size="small">
          <InputLabel id="arrow-missed-label">
            Show the better move for
          </InputLabel>
          <Select
            labelId="arrow-missed-label"
            input={<OutlinedInput label="Show the better move for" />}
            value={tuning.missedFrom}
            onChange={(event) =>
              update({ missedFrom: event.target.value as MissedFrom })
            }
          >
            {(Object.keys(MISSED_FROM_LABELS) as MissedFrom[]).map((key) => (
              <MenuItem key={key} value={key}>
                {MISSED_FROM_LABELS[key]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          The checkered arrow that shows what you should have played instead of
          the last move.
        </Typography>
      </Grid>

      <Grid size={12}>
        <Typography variant="subtitle2" gutterBottom>
          Threats
        </Typography>
        <Stack spacing={0.75}>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={tuning.threatSensitivity}
            aria-label="Threat sensitivity"
            onChange={(_, value: ThreatSensitivity | null) =>
              value && update({ threatSensitivity: value })
            }
          >
            {(
              Object.keys(THREAT_SENSITIVITY_LABELS) as ThreatSensitivity[]
            ).map((key) => (
              <ToggleButton key={key} value={key}>
                {THREAT_SENSITIVITY_LABELS[key].label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            {THREAT_SENSITIVITY_LABELS[tuning.threatSensitivity].help} A threat
            is what the opponent would gain by moving first.
          </Typography>
        </Stack>
      </Grid>

      <Slider
        label="Threats shown"
        value={tuning.threatsShown}
        setValue={(threatsShown) => update({ threatsShown })}
        min={THREATS_SHOWN_RANGE.min}
        max={THREATS_SHOWN_RANGE.max}
        marksFilter={1}
        size={6}
      />
      <Slider
        label="Threat search depth"
        value={tuning.threatDepth}
        setValue={(threatDepth) => update({ threatDepth })}
        min={THREAT_DEPTH_RANGE.min}
        max={THREAT_DEPTH_RANGE.max}
        marksFilter={2}
        infoContent={
          <>
            How deep the search goes when it hands the move to the opponent. A
            threat is judged against the position&apos;s own evaluation, so it
            can be shallower than the analysis depth.
          </>
        }
      />

      <Grid size={12}>
        <Button size="small" onClick={() => setTuning(ARROW_TUNING_DEFAULTS)}>
          Reset to defaults
        </Button>
      </Grid>
    </Grid>
  );
}
