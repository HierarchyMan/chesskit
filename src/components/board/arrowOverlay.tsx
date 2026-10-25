import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { SideNamer, legendFor } from "@/lib/arrows/legend";
import { mergeArrows } from "@/lib/arrows/merge";
import { ArrowCapabilities, ArrowPrefs } from "@/lib/arrows/prefs";
import { arrowPaletteAtom } from "@/lib/arrows/paletteAtom";
import { ArrowFocus, ArrowSide, BoardArrow } from "@/lib/arrows/types";
import { useAtomValue } from "jotai";
import { Icon } from "@iconify/react";
import {
  Box,
  Button,
  FormControlLabel,
  Switch,
  TextField,
  IconButton,
  Popover,
  Stack,
  Typography,
} from "@mui/material";
import { ReactNode, useMemo, useState } from "react";
import { ArrowGlyph } from "./arrowLayer";

/** Where the overlay controls are: beside the board, or behind a summary. */
export type OverlayView = "inspector" | "compact";

interface Props {
  prefs: ArrowPrefs;
  capabilities: ArrowCapabilities;
  onChange: (change: Partial<ArrowPrefs>) => void;
  /** What is drawn now, so the legend lists only the kinds that are really there. */
  arrows: readonly BoardArrow[];
  nameOf: SideNamer;
  /** The side to move on the displayed board: the palette's first hue. */
  turn: ArrowSide;
  onFocus: (focus: ArrowFocus | null) => void;
  view: OverlayView;
  /** Anything else the panel keeps with these controls, such as board display switches. */
  extra?: ReactNode;
}

const countLabel = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/** What the arrows are set to do, in a few words, for the compact summary. */
export const overlaySummary = (
  prefs: ArrowPrefs,
  capabilities: ArrowCapabilities
): string => {
  if (!prefs.enabled) return "Arrows off";

  const parts: string[] = [];
  if (capabilities.maxMoves > 0 && prefs.moves > 0) {
    parts.push(countLabel(prefs.moves, "move"));
  }
  if (capabilities.maxAhead > 0 && prefs.ahead > 0 && prefs.moves > 0) {
    parts.push(`${prefs.ahead} ahead`);
  }
  if (capabilities.missed && prefs.missed) parts.push("missed");
  if (capabilities.threats && prefs.threats) parts.push("threats");

  return parts.length ? `Arrows · ${parts.join(" · ")}` : "Arrows · none";
};

function CountChoice({
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
        sx={{ width: 84, "& select": { py: 0.75 } }}
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

function SwitchChip({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
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
      sx={{ m: 0, minHeight: 34, justifyContent: "space-between", gap: 2 }}
    />
  );
}

/**
 * The arrows' own settings, the legend, and whatever the panel keeps beside
 * them. The legend lists only the arrows on the board. Pointing at an entry, or
 * tabbing to it, puts that role or candidate in the foreground.
 */
function Controls({
  prefs,
  capabilities,
  onChange,
  arrows,
  nameOf,
  turn,
  onFocus,
  extra,
}: Omit<Props, "view">) {
  const legend = useMemo(
    () => legendFor(mergeArrows(arrows), nameOf),
    [arrows, nameOf]
  );
  const other: ArrowSide = turn === "w" ? "b" : "w";
  const palette = useAtomValue(arrowPaletteAtom);
  const { enabled } = prefs;

  return (
    <Stack spacing={1.5} sx={{ minWidth: 0 }}>
      <SwitchChip
        label="Engine arrows"
        checked={enabled}
        disabled={false}
        onChange={(next) => onChange({ enabled: next })}
      />

      {capabilities.maxMoves > 0 && (
        <CountChoice
          label="Moves"
          value={prefs.moves}
          max={capabilities.maxMoves}
          disabled={!enabled}
          onChange={(moves) => onChange({ moves })}
        />
      )}
      {capabilities.maxAhead > 0 && (
        <CountChoice
          label="Ahead"
          value={prefs.ahead}
          max={capabilities.maxAhead}
          disabled={!enabled || prefs.moves === 0}
          onChange={(ahead) => onChange({ ahead })}
        />
      )}

      {(capabilities.missed || capabilities.threats) && (
        <Stack gap={0}>
          {capabilities.missed && (
            <SwitchChip
              label="Missed"
              checked={prefs.missed}
              disabled={!enabled}
              onChange={(missed) => onChange({ missed })}
            />
          )}
          {capabilities.threats && (
            <SwitchChip
              label="Threats (X)"
              checked={prefs.threats}
              disabled={!enabled}
              onChange={(threats) => onChange({ threats })}
            />
          )}
        </Stack>
      )}

      {legend.length > 0 && (
        <Stack gap={1} onMouseLeave={() => onFocus(null)}>
          <Stack direction="row" gap={2} flexWrap="wrap">
            <KeyChip color={palette.toMove} text={`${nameOf(turn)} move`} />
            <KeyChip color={palette.other} text={`${nameOf(other)} move`} />
          </Stack>
          {legend.map((entry) => (
            <LegendRow
              key={entry.key}
              text={entry.text}
              focus={entry.focus}
              turn={turn}
              arrow={entry.arrow}
              onFocus={onFocus}
            />
          ))}
        </Stack>
      )}

      {extra}
    </Stack>
  );
}

function KeyChip({ color, text }: { color: string; text: string }) {
  return (
    <Stack direction="row" alignItems="center" gap={0.75}>
      <Box
        aria-hidden
        sx={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          backgroundColor: color,
        }}
      />
      <Typography variant="body2">{text}</Typography>
    </Stack>
  );
}

/**
 * One legend entry: its sample and its words. It can be reached with the
 * keyboard as well as the pointer, and tapping it on a touch screen focuses it.
 */
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
        minHeight: 36,
        borderRadius: 1,
        px: 0.5,
        outlineOffset: 2,
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
 * The overlay controls, as an inspector beside the board or as a summary above
 * it that opens the same controls in a popover. The shortcuts belong to the
 * board, so they work in either view.
 */
export default function ArrowOverlay({ view, ...rest }: Props) {
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const { prefs, capabilities, onChange } = rest;

  useKeyboardShortcut("a", () => onChange({ enabled: !prefs.enabled }));
  const digits = useMemo(
    () => Array.from({ length: capabilities.maxMoves }, (_, i) => `${i + 1}`),
    [capabilities.maxMoves]
  );
  useKeyboardShortcut(
    digits,
    (event) => onChange({ enabled: true, moves: Number(event.key) }),
    capabilities.maxMoves > 0
  );
  useKeyboardShortcut(
    "x",
    () => onChange({ enabled: true, threats: !prefs.threats }),
    capabilities.threats
  );

  const close = () => {
    setOpen(false);
    rest.onFocus(null);
  };

  return (
    <>
      <Button
        ref={setTrigger}
        variant={view === "inspector" ? "text" : "outlined"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        startIcon={<Icon icon="mdi:arrow-top-right" height={18} />}
        endIcon={
          <Icon
            icon={open ? "mdi:chevron-up" : "mdi:chevron-down"}
            height={18}
          />
        }
        sx={{
          minHeight: 36,
          width: view === "inspector" ? "100%" : undefined,
          justifyContent: "flex-start",
          color: "text.primary",
          textTransform: "none",
          fontSize: "0.85rem",
          borderRadius: 1,
          "& .MuiButton-endIcon": { ml: "auto" },
        }}
      >
        <Box component="span" sx={{ textAlign: "left", minWidth: 0 }}>
          <Box component="span" sx={{ display: "block", fontWeight: 600 }}>
            Board overlays
          </Box>
          <Typography component="span" variant="caption" color="text.secondary">
            {overlaySummary(prefs, capabilities)}
          </Typography>
        </Box>
      </Button>
      <Popover
        open={open}
        anchorEl={trigger}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            // The paper clips its corners and holds the header still, so only
            // the controls scroll and every corner stays rounded.
            sx: {
              width: "min(360px, calc(100vw - 32px))",
              maxHeight: "min(70dvh, 560px)",
              borderRadius: 2,
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
          sx={{ px: 2, pt: 1.5, pb: 1, flexShrink: 0 }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            Board overlays
          </Typography>
          <IconButton aria-label="Close board overlays" onClick={close}>
            <Icon icon="mdi:close" height={20} />
          </IconButton>
        </Stack>
        <Box sx={{ px: 2, pb: 2, overflowY: "auto", minHeight: 0 }}>
          <Controls {...rest} />
        </Box>
      </Popover>
    </>
  );
}
