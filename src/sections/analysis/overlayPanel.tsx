import { ArrowGlyph } from "@/components/board/arrowLayer";
import { overlaySummary } from "@/components/board/arrowOverlay";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { colorNamer, legendFor } from "@/lib/arrows/legend";
import { mergeArrows } from "@/lib/arrows/merge";
import { arrowPaletteAtom } from "@/lib/arrows/paletteAtom";
import { ARROW_CAPABILITIES } from "@/lib/arrows/prefs";
import { ArrowFocus, ArrowSide, BoardArrow } from "@/lib/arrows/types";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControlLabel,
  IconButton,
  Popover,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useAtom, useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { useAnalysisEngine } from "./engineContext";
import { AnalysisOverlay } from "./hooks/useAnalysisOverlay";
import { analysisPositionErrorAtom } from "./sessionAtoms";
import { analysisOptionAtoms, boardAtom } from "./states";

const DISPLAY_SWITCHES = [
  {
    atom: analysisOptionAtoms.evaluation,
    label: "Evaluation bar",
    help: "Score bar beside the board. Analysis keeps running while hidden.",
  },
  {
    atom: analysisOptionAtoms.annotations,
    label: "Move annotations",
    help: "Quality badge on the board for played moves.",
  },
];

function SwitchRow({
  label,
  help,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Box>
      <FormControlLabel
        labelPlacement="start"
        label={<Typography variant="body2">{label}</Typography>}
        control={
          <Switch
            size="small"
            checked={checked}
            disabled={disabled}
            onChange={(_, next) => onChange(next)}
          />
        }
        sx={{
          m: 0,
          width: "100%",
          minHeight: 34,
          justifyContent: "space-between",
          gap: 2,
        }}
      />
      {help && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ mt: -0.25, mb: 0.5 }}
        >
          {help}
        </Typography>
      )}
    </Box>
  );
}

function CountRow({
  label,
  value,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const options = Array.from({ length: max + 1 }, (_, count) => count);
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap={2}
    >
      <Typography variant="body2" sx={{ opacity: disabled ? 0.5 : 1 }}>
        {label}
      </Typography>
      <TextField
        select
        size="small"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        slotProps={{
          select: { native: true },
          htmlInput: { "aria-label": label },
        }}
        sx={{ width: 84, "& select": { py: 0.65 } }}
      >
        {options.map((count) => (
          <option key={count} value={count}>
            {count}
          </option>
        ))}
      </TextField>
    </Stack>
  );
}

function DisplaySwitchItem({
  atom,
  label,
  help,
}: {
  atom: typeof analysisOptionAtoms.evaluation;
  label: string;
  help: string;
}) {
  const [checked, setChecked] = useAtom(atom);
  return (
    <SwitchRow
      label={label}
      help={help}
      checked={checked}
      onChange={setChecked}
    />
  );
}

function LegendRow({
  text,
  focus,
  turn,
  arrow,
  onFocus,
}: {
  text: string;
  focus: ArrowFocus;
  turn: ArrowSide;
  arrow: BoardArrow;
  onFocus: (focus: ArrowFocus | null) => void;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={1}
      tabIndex={0}
      role="button"
      aria-label={text}
      onMouseEnter={() => onFocus(focus)}
      onFocus={() => onFocus(focus)}
      onBlur={() => onFocus(null)}
      onClick={() => onFocus(focus)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onFocus(focus);
        }
      }}
      sx={{
        minHeight: 34,
        borderRadius: 1,
        px: 0.5,
        cursor: "pointer",
        "&:hover": { bgcolor: "action.hover" },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
        },
      }}
    >
      <ArrowGlyph arrow={arrow} turn={turn} />
      <Typography variant="body2">{text}</Typography>
    </Stack>
  );
}

/**
 * Visible inline failure alert for position analysis errors — mounted directly
 * above Engine Lines so failures are never trapped inside a closed popover.
 */
export function AnalysisFailure() {
  const error = useAtomValue(analysisPositionErrorAtom);
  const engine = useAnalysisEngine();
  if (!error) return null;
  return (
    <Alert
      severity="error"
      sx={{ py: 0.25 }}
      action={
        <Button size="small" onClick={engine.retry}>
          Retry
        </Button>
      }
    >
      {error}
    </Alert>
  );
}

/**
 * Compact header icon trigger that opens the Analysis board overlays & display
 * popover. Registers the global board arrow shortcuts (A, 1–N, X).
 */
export default function AnalysisOverlayPanel({
  overlay,
}: {
  overlay: AnalysisOverlay;
}) {
  const turn = useAtomValue(boardAtom).turn();
  const palette = useAtomValue(arrowPaletteAtom);
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const capabilities = ARROW_CAPABILITIES.analysis;
  const { prefs, update, arrows, setFocus } = overlay;

  useKeyboardShortcut("a", () => update({ enabled: !prefs.enabled }));
  const digits = useMemo(
    () => Array.from({ length: capabilities.maxMoves }, (_, i) => `${i + 1}`),
    [capabilities.maxMoves]
  );
  useKeyboardShortcut(
    digits,
    (event) => update({ enabled: true, moves: Number(event.key) }),
    capabilities.maxMoves > 0
  );
  useKeyboardShortcut(
    "x",
    () => update({ enabled: true, threats: !prefs.threats }),
    capabilities.threats
  );

  const legend = useMemo(
    () => legendFor(mergeArrows(arrows), colorNamer),
    [arrows]
  );
  const other: ArrowSide = turn === "w" ? "b" : "w";
  const summary = overlaySummary(prefs, capabilities);

  const close = () => {
    setOpen(false);
    setFocus(null);
  };

  return (
    <>
      <Tooltip title={`Board overlays · ${summary}`} disableInteractive>
        <IconButton
          ref={setTrigger}
          size="small"
          aria-label={`Board overlays (${summary})`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          color={prefs.enabled ? "primary" : "default"}
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            border: 1,
            borderColor: open
              ? "primary.main"
              : prefs.enabled
                ? "divider"
                : "transparent",
            bgcolor: open ? "action.selected" : undefined,
          }}
        >
          <Icon icon="mdi:layers-outline" height={18} />
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={trigger}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              width: "min(340px, calc(100vw - 32px))",
              maxHeight: "min(70dvh, 560px)",
              borderRadius: 1.5,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            },
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: 2,
            py: 1.25,
            flexShrink: 0,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Typography variant="subtitle2" fontWeight={600}>
            Board overlays
          </Typography>
          <IconButton
            size="small"
            aria-label="Close board overlays"
            onClick={close}
          >
            <Icon icon="mdi:close" height={18} />
          </IconButton>
        </Stack>

        <Box sx={{ px: 2, py: 1.5, overflowY: "auto", minHeight: 0 }}>
          <Stack spacing={1.25}>
            <SwitchRow
              label="Engine arrows (A)"
              checked={prefs.enabled}
              onChange={(next) => update({ enabled: next })}
            />

            {capabilities.maxMoves > 0 && (
              <CountRow
                label="Candidate arrows"
                value={prefs.moves}
                max={capabilities.maxMoves}
                disabled={!prefs.enabled}
                onChange={(moves) => update({ moves })}
              />
            )}

            {capabilities.maxAhead > 0 && (
              <CountRow
                label="Follow-up plies"
                value={prefs.ahead}
                max={capabilities.maxAhead}
                disabled={!prefs.enabled || prefs.moves === 0}
                onChange={(ahead) => update({ ahead })}
              />
            )}

            {capabilities.missed && (
              <SwitchRow
                label="Missed best move"
                checked={prefs.missed}
                disabled={!prefs.enabled}
                onChange={(missed) => update({ missed })}
              />
            )}

            {capabilities.threats && (
              <SwitchRow
                label="Opponent threats (X)"
                checked={prefs.threats}
                disabled={!prefs.enabled}
                onChange={(threats) => update({ threats })}
              />
            )}

            {legend.length > 0 && (
              <>
                <Divider />
                <Stack gap={0.5} onMouseLeave={() => setFocus(null)}>
                  <Stack direction="row" gap={2} flexWrap="wrap" pb={0.25}>
                    <Stack direction="row" alignItems="center" gap={0.75}>
                      <Box
                        aria-hidden
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          bgcolor: palette.toMove,
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {colorNamer(turn)} move
                      </Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" gap={0.75}>
                      <Box
                        aria-hidden
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          bgcolor: palette.other,
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {colorNamer(other)} move
                      </Typography>
                    </Stack>
                  </Stack>
                  {legend.map((entry) => (
                    <LegendRow
                      key={entry.key}
                      text={entry.text}
                      focus={entry.focus}
                      turn={turn}
                      arrow={entry.arrow}
                      onFocus={setFocus}
                    />
                  ))}
                </Stack>
              </>
            )}

            <Divider />

            <Stack gap={0.25}>
              <Typography
                variant="caption"
                fontWeight={600}
                color="text.secondary"
                sx={{ textTransform: "uppercase", letterSpacing: 0.4 }}
              >
                Display
              </Typography>
              {DISPLAY_SWITCHES.map(({ atom, label, help }) => (
                <DisplaySwitchItem
                  key={label}
                  atom={atom}
                  label={label}
                  help={help}
                />
              ))}
            </Stack>
          </Stack>
        </Box>
      </Popover>
    </>
  );
}
