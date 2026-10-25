import MiniBoard from "@/components/board/miniBoard";
import Slider from "@/components/slider";
import { arrowContrast } from "@/lib/arrows/contrast";
import {
  ARROW_HUE_PRESETS,
  ARROW_PALETTE_DEFAULTS,
  ArrowPalette,
  MIN_HUE_SEPARATION,
  sameHue,
} from "@/lib/arrows/palette";
import { arrowPaletteAtom } from "@/lib/arrows/paletteAtom";
import { BoardArrow } from "@/lib/arrows/types";
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
import { Icon } from "@iconify/react";
import {
  Box,
  Button,
  ButtonBase,
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

// White to move: the first two arrows are White's, so they take the side-to-move
// hue; the threat is Black's, so it takes the other hue.
const PREVIEW_FEN =
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
const PREVIEW_ARROWS: BoardArrow[] = [
  { from: "f3", to: "e5", kind: "best", side: "w", rank: 1 },
  { from: "d2", to: "d4", kind: "candidate", side: "w", rank: 2 },
  { from: "f6", to: "e4", kind: "threat", side: "b", label: "!" },
];

const SIDES: { key: keyof ArrowPalette; label: string }[] = [
  { key: "toMove", label: "Side to move" },
  { key: "other", label: "Other side" },
];

const swatchSx = (selected: boolean) => ({
  width: 32,
  height: 32,
  borderRadius: 1.5,
  outline: selected ? "3px solid" : "1px solid",
  outlineColor: selected ? "primary.main" : "divider",
  outlineOffset: selected ? 1 : 0,
});

/** One side's hue: the preset swatches, then a swatch that opens the system colour picker. */
function HueChoice({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const custom = !ARROW_HUE_PRESETS.some((preset) =>
    sameHue(preset.hex, value)
  );

  return (
    <Box>
      <Typography variant="body2" gutterBottom>
        {label}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {ARROW_HUE_PRESETS.map((preset) => (
          <ButtonBase
            key={preset.hex}
            title={preset.label}
            aria-label={`${label}: ${preset.label}`}
            aria-pressed={sameHue(preset.hex, value)}
            onClick={() => onChange(preset.hex)}
            sx={{
              ...swatchSx(sameHue(preset.hex, value)),
              backgroundColor: preset.hex,
            }}
          />
        ))}
        <ButtonBase
          component="label"
          title="Pick another colour"
          sx={{
            ...swatchSx(custom),
            position: "relative",
            overflow: "hidden",
            color: "text.secondary",
            backgroundColor: custom ? value : "action.hover",
            "&:focus-within": {
              outline: "3px solid",
              outlineColor: "primary.main",
            },
          }}
        >
          {!custom && <Icon icon="mdi:eyedropper-variant" height={18} />}
          <input
            type="color"
            aria-label={`${label}: custom colour`}
            value={value.toLowerCase()}
            onChange={(event) => onChange(event.target.value)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: 0,
              cursor: "pointer",
            }}
          />
        </ButtonBase>
      </Stack>
    </Box>
  );
}

export default function ArrowsTab() {
  const [tuning, setTuning] = useAtom(arrowTuningAtom);
  const [palette, setPalette] = useAtom(arrowPaletteAtom);
  const update = (change: Partial<ArrowTuning>) =>
    setTuning((current) => ({ ...current, ...change }));
  const isDefaultPalette =
    sameHue(palette.toMove, ARROW_PALETTE_DEFAULTS.toMove) &&
    sameHue(palette.other, ARROW_PALETTE_DEFAULTS.other);
  const hardToTellApart =
    arrowContrast(palette.toMove, palette.other) < MIN_HUE_SEPARATION;

  return (
    <Grid container spacing={3} alignItems="flex-start">
      <Grid size={12}>
        <Typography variant="caption" sx={{ opacity: 0.75 }}>
          Which arrows to show, and how many, is set on the board under it. Here
          you set how they look and how they decide. Each feature&apos;s engine
          is chosen in the Engine tab.
        </Typography>
      </Grid>

      <Grid size={{ xs: 12, sm: 5 }} display="flex" justifyContent="center">
        <MiniBoard
          fen={PREVIEW_FEN}
          size={200}
          arrows={PREVIEW_ARROWS}
          animationDuration={0}
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 7 }}>
        <Typography variant="subtitle2" gutterBottom>
          Arrow colours
        </Typography>
        <Stack spacing={2}>
          {SIDES.map(({ key, label }) => (
            <HueChoice
              key={key}
              label={label}
              value={palette[key]}
              onChange={(hex) =>
                setPalette((current) => ({ ...current, [key]: hex }))
              }
            />
          ))}
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            {hardToTellApart
              ? "These two colours are hard to tell apart, so you could not see whose move an arrow is. "
              : "Whose move an arrow is shows in its colour. "}
            Each is lightened or darkened a little where it would be hard to see
            on the board you play on.
          </Typography>
          <Box>
            <Button
              size="small"
              disabled={isDefaultPalette}
              onClick={() => setPalette(ARROW_PALETTE_DEFAULTS)}
            >
              Reset colours
            </Button>
          </Box>
        </Stack>
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
          Reset decisions to defaults
        </Button>
      </Grid>
    </Grid>
  );
}
