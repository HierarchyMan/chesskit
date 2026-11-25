import MiniBoard from "@/components/board/miniBoard";
import { useEffectiveThreatDepth } from "@/hooks/useEffectiveEngineSettings";
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
import { threatsInheritAtom } from "@/lib/engine/engineSettings";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  ClickAwayListener,
  Divider,
  FormControl,
  Grid2 as Grid,
  IconButton,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Popover,
  Select,
  Slider as MuiSlider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useAtom } from "jotai";
import { MouseEvent, ReactNode, useMemo, useState } from "react";

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

const INHERIT_SOURCE_LABEL: Record<string, string> = {
  analysis: "Analysis",
  coach: "Coach",
  bot: "Bot",
};

const swatchSx = (selected: boolean) => ({
  width: 32,
  height: 32,
  borderRadius: 1,
  outline: selected ? "2.5px solid" : "1px solid",
  outlineColor: selected ? "primary.main" : "divider",
  outlineOffset: selected ? 1 : 0,
});

function ArrowSlider({
  label,
  value,
  setValue,
  min,
  max,
  marksFilter,
  disabled = false,
  formatValue = (v) => `${v}`,
  infoContent,
}: {
  label: string;
  value: number;
  setValue: (next: number) => void;
  min: number;
  max: number;
  marksFilter?: number;
  disabled?: boolean;
  formatValue?: (v: number) => string;
  infoContent?: ReactNode;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const handleOpen = (event: MouseEvent<HTMLElement>) =>
    setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const marks = useMemo(() => {
    if (!marksFilter) return undefined;
    return Array.from({ length: max - min + 1 }, (_, i) => ({
      value: i + min,
      label: `${i + min}`,
    })).filter((_, i) => i % marksFilter === 0);
  }, [marksFilter, max, min]);

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        mb={0.25}
      >
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Typography
            variant="body2"
            fontWeight={500}
            color={disabled ? "text.disabled" : "text.primary"}
          >
            {label}
          </Typography>
          {!!infoContent && (
            <>
              <ClickAwayListener onClickAway={handleClose}>
                <IconButton
                  size="small"
                  aria-label={`Help about ${label}`}
                  onClick={handleOpen}
                  onMouseEnter={handleOpen}
                  onMouseLeave={handleClose}
                  sx={{ p: 0.25, color: "text.secondary" }}
                >
                  <Icon icon="mdi:information-outline" height={16} />
                </IconButton>
              </ClickAwayListener>
              <Popover
                open={!!anchorEl}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                transformOrigin={{ vertical: "top", horizontal: "center" }}
                sx={{ pointerEvents: "none" }}
                disableRestoreFocus
              >
                <Typography variant="body2" sx={{ p: 1.75, maxWidth: 360 }}>
                  {infoContent}
                </Typography>
              </Popover>
            </>
          )}
        </Stack>
        <Typography
          variant="caption"
          fontWeight={600}
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: 1,
            bgcolor: disabled ? "action.disabledBackground" : "action.selected",
            color: disabled ? "text.disabled" : "text.primary",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {formatValue(value)}
        </Typography>
      </Stack>

      <MuiSlider
        size="small"
        disabled={disabled}
        min={min}
        max={max}
        marks={marks}
        value={value}
        valueLabelDisplay="off"
        aria-label={label}
        onChange={(_, next) => setValue(next as number)}
        sx={{
          "& .MuiSlider-markLabel": {
            fontSize: "0.72rem",
            lineHeight: 1.1,
          },
          mb: marks ? 1.5 : 0.25,
        }}
      />
    </Box>
  );
}

/** One side's hue: the preset swatches, then a swatch that opens the system color picker. */
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
      <Typography variant="body2" fontWeight={500} gutterBottom>
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
          title="Pick another color"
          sx={{
            ...swatchSx(custom),
            position: "relative",
            overflow: "hidden",
            color: "text.secondary",
            backgroundColor: custom ? value : "action.hover",
            "&:focus-within": {
              outline: "2.5px solid",
              outlineColor: "primary.main",
            },
          }}
        >
          {!custom && <Icon icon="mdi:eyedropper-variant" height={18} />}
          <input
            type="color"
            aria-label={`${label}: custom color`}
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
  const [threatsInherit, setThreatsInherit] = useAtom(threatsInheritAtom);
  const effThreat = useEffectiveThreatDepth();

  const update = (change: Partial<ArrowTuning>) =>
    setTuning((current) => ({ ...current, ...change }));

  const isDefaultPalette =
    sameHue(palette.toMove, ARROW_PALETTE_DEFAULTS.toMove) &&
    sameHue(palette.other, ARROW_PALETTE_DEFAULTS.other);

  const isDefaultTuning =
    tuning.settleDepth === ARROW_TUNING_DEFAULTS.settleDepth &&
    tuning.missedFrom === ARROW_TUNING_DEFAULTS.missedFrom &&
    tuning.threatSensitivity === ARROW_TUNING_DEFAULTS.threatSensitivity &&
    tuning.threatsShown === ARROW_TUNING_DEFAULTS.threatsShown &&
    tuning.threatDepth === ARROW_TUNING_DEFAULTS.threatDepth;

  const hardToTellApart =
    arrowContrast(palette.toMove, palette.other) < MIN_HUE_SEPARATION;

  const threatDepthInherited = threatsInherit !== "custom";

  return (
    <Grid container spacing={2.5} alignItems="flex-start">
      <Grid size={12}>
        <Typography variant="caption" color="text.secondary">
          Toggle which arrows appear directly on the board controls. Here you
          customize arrow colors and search sensitivity. Feature engines are set
          in the Engine tab.
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
        <Stack spacing={1.75}>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ fontWeight: 700, letterSpacing: "0.08em", lineHeight: 1.2 }}
          >
            Arrow colors
          </Typography>
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
          {hardToTellApart ? (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              These two colors have low contrast and may be hard to tell apart
              on the board.
            </Alert>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Each color automatically adjusts lightness where needed to stay
              readable against your board theme.
            </Typography>
          )}
          <Box>
            <Button
              size="small"
              color="inherit"
              disabled={isDefaultPalette}
              startIcon={<Icon icon="mdi:restore" height={16} />}
              onClick={() => setPalette(ARROW_PALETTE_DEFAULTS)}
            >
              Reset colors
            </Button>
          </Box>
        </Stack>
      </Grid>

      <Grid size={12}>
        <Divider />
      </Grid>

      <Grid size={12}>
        <ArrowSlider
          label="Wait for search depth"
          value={tuning.settleDepth}
          setValue={(settleDepth) => update({ settleDepth })}
          min={SETTLE_DEPTH_RANGE.min}
          max={SETTLE_DEPTH_RANGE.max}
          marksFilter={2}
          formatValue={(v) => `Depth ${v}`}
          infoContent="The first lines of a search jump between moves. Arrows wait until the search has reached this depth. Lower values show arrows sooner; higher values show steadier arrows."
        />
      </Grid>

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
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.5, display: "block" }}
        >
          Controls when the checkered arrow shows what you could have played
          instead of the last move.
        </Typography>
      </Grid>

      <Grid size={12}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{
            fontWeight: 700,
            letterSpacing: "0.08em",
            display: "block",
            mb: 1,
          }}
        >
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
          <Typography variant="caption" color="text.secondary">
            {THREAT_SENSITIVITY_LABELS[tuning.threatSensitivity].help} A threat
            is what the opponent would gain by moving first.
          </Typography>
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, sm: 6 }}>
        <ArrowSlider
          label="Threats shown"
          value={tuning.threatsShown}
          setValue={(threatsShown) => update({ threatsShown })}
          min={THREATS_SHOWN_RANGE.min}
          max={THREATS_SHOWN_RANGE.max}
          marksFilter={1}
          formatValue={(v) => `${v} ${v === 1 ? "threat" : "threats"}`}
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6 }}>
        <ArrowSlider
          label="Threat search depth"
          disabled={threatDepthInherited}
          value={threatDepthInherited ? effThreat.depth : tuning.threatDepth}
          setValue={(threatDepth) => update({ threatDepth })}
          min={THREAT_DEPTH_RANGE.min}
          max={THREAT_DEPTH_RANGE.max}
          marksFilter={2}
          formatValue={(v) => `Depth ${v}`}
          infoContent="How deep the search goes when it hands the move to the opponent. A threat is judged against the position's own evaluation, so it can be shallower than the analysis depth."
        />
      </Grid>

      {threatDepthInherited && (
        <Grid size={12}>
          <Alert
            severity="info"
            sx={{ py: 0.5, alignItems: "center" }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => setThreatsInherit("custom")}
              >
                Customize
              </Button>
            }
          >
            Threat search depth currently follows your{" "}
            <b>{INHERIT_SOURCE_LABEL[threatsInherit] ?? threatsInherit}</b>{" "}
            engine profile (Depth {effThreat.depth}).
          </Alert>
        </Grid>
      )}

      <Grid size={12}>
        <Button
          size="small"
          color="inherit"
          disabled={isDefaultTuning}
          startIcon={<Icon icon="mdi:restore" height={16} />}
          onClick={() => setTuning(ARROW_TUNING_DEFAULTS)}
        >
          Reset decisions to defaults
        </Button>
      </Grid>
    </Grid>
  );
}
