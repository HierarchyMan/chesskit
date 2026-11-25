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
  IconButton,
  MenuItem,
  Popover,
  Select,
  Stack,
  Switch,
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

export type ArrowOverlayControlsProps = Omit<Props, "view">;

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
      <Select
        size="small"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        inputProps={{ "aria-label": label }}
        sx={{
          minWidth: 74,
          borderRadius: 1,
          "& .MuiSelect-select": {
            py: 0.5,
            px: 1.25,
            fontSize: "0.85rem",
            fontVariantNumeric: "tabular-nums",
          },
        }}
      >
        {options.map((count) => (
          <MenuItem
            key={count}
            value={count}
            sx={{ fontSize: "0.85rem", fontVariantNumeric: "tabular-nums" }}
          >
            {count}
          </MenuItem>
        ))}
      </Select>
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
      sx={{
        m: 0,
        width: "100%",
        minHeight: 34,
        justifyContent: "space-between",
        gap: 2,
      }}
    />
  );
}

/**
 * The arrows' own settings, the legend, and whatever the panel keeps beside
 * them. The legend lists only the arrows on the board. Pointing at an entry, or
 * tabbing to it, puts that role or candidate in the foreground.
 */
export function ArrowOverlayControls({
  prefs,
  capabilities,
  onChange,
  arrows,
  nameOf,
  turn,
  onFocus,
  extra,
}: ArrowOverlayControlsProps) {
  const legend = useMemo(
    () => legendFor(mergeArrows(arrows), nameOf),
    [arrows, nameOf]
  );
  const other: ArrowSide = turn === "w" ? "b" : "w";
  const palette = useAtomValue(arrowPaletteAtom);
  const { enabled } = prefs;

  return (
    <Stack spacing={1.25} sx={{ minWidth: 0 }}>
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
        <Stack
          gap={0.75}
          pt={0.5}
          borderTop={1}
          borderColor="divider"
          onMouseLeave={() => onFocus(null)}
        >
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

      {extra && (
        <Box
          sx={{
            pt: 0.75,
            borderTop: 1,
            borderColor: "divider",
            "& .MuiFormControlLabel-root": {
              m: 0,
              width: "100%",
              minHeight: 34,
              flexDirection: "row-reverse",
              justifyContent: "space-between",
              gap: 2,
            },
          }}
        >
          {extra}
        </Box>
      )}
    </Stack>
  );
}

function KeyChip({ color, text }: { color: string; text: string }) {
  return (
    <Stack direction="row" alignItems="center" gap={0.75}>
      <Box
        aria-hidden
        sx={{
          width: 11,
          height: 11,
          borderRadius: "50%",
          backgroundColor: color,
        }}
      />
      <Typography variant="caption" color="text.secondary">
        {text}
      </Typography>
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
        minHeight: 32,
        borderRadius: 1,
        px: 0.75,
        cursor: "pointer",
        outlineOffset: 2,
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
 * The overlay controls, as an inspector trigger or as a summary above the board
 * that opens the same controls in a popover. The shortcuts belong to the board,
 * so they work in either view.
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

  const summary = overlaySummary(prefs, capabilities);
  const isInspector = view === "inspector";

  return (
    <>
      <Button
        ref={setTrigger}
        size="small"
        variant={isInspector ? "text" : "outlined"}
        color="inherit"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        startIcon={<Icon icon="mdi:arrow-top-right" height={17} />}
        endIcon={
          <Icon
            icon={
              isInspector
                ? open
                  ? "mdi:chevron-down"
                  : "mdi:chevron-up"
                : open
                  ? "mdi:chevron-up"
                  : "mdi:chevron-down"
            }
            height={17}
          />
        }
        sx={{
          minHeight: 34,
          width: isInspector ? "100%" : undefined,
          justifyContent: "flex-start",
          px: 1.25,
          py: 0.5,
          color: "text.primary",
          textTransform: "none",
          fontSize: "0.82rem",
          borderRadius: 1,
          bgcolor: open ? "action.hover" : "transparent",
          "&:hover": { bgcolor: "action.hover" },
          "& .MuiButton-endIcon": { ml: "auto", color: "text.secondary" },
          "& .MuiButton-startIcon": { color: "text.secondary" },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          gap={1}
          sx={{ minWidth: 0, flex: 1, overflow: "hidden" }}
        >
          <Box component="span" sx={{ fontWeight: 600, flexShrink: 0 }}>
            Overlays
          </Box>
          <Typography
            component="span"
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ minWidth: 0 }}
          >
            {summary}
          </Typography>
        </Stack>
      </Button>
      <Popover
        open={open}
        anchorEl={trigger}
        onClose={close}
        marginThreshold={12}
        anchorOrigin={{
          vertical: isInspector ? "top" : "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: isInspector ? "bottom" : "top",
          horizontal: "left",
        }}
        slotProps={{
          paper: {
            // The paper clips its corners and holds the header still, so only
            // the controls scroll and every corner stays rounded.
            sx: {
              width: "min(340px, calc(100vw - 32px))",
              maxHeight: "min(70dvh, 520px)",
              borderRadius: 1.5,
              border: 1,
              borderColor: "divider",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              my: 0.75,
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
            borderBottom: 1,
            borderColor: "divider",
            flexShrink: 0,
          }}
        >
          <Typography variant="subtitle2" fontWeight={700}>
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
          <ArrowOverlayControls {...rest} />
        </Box>
      </Popover>
    </>
  );
}
