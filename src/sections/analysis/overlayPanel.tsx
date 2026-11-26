import {
  ArrowOverlayControls,
  overlaySummary,
} from "@/components/board/arrowOverlay";
import {
  InspectorPopover,
  PopoverSectionLabel,
  PopoverSwitchRow,
} from "@/components/inspector/inspectorPopover";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { colorNamer } from "@/lib/arrows/legend";
import { ARROW_CAPABILITIES } from "@/lib/arrows/prefs";
import { Icon } from "@iconify/react";
import {
  Alert,
  Button,
  Divider,
  IconButton,
  Stack,
  Tooltip,
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
    <PopoverSwitchRow
      label={label}
      help={help}
      checked={checked}
      onChange={setChecked}
    />
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
 * popover using the shared InspectorPopover + ArrowOverlayControls primitives.
 */
export default function AnalysisOverlayPanel({
  overlay,
}: {
  overlay: AnalysisOverlay;
}) {
  const turn = useAtomValue(boardAtom).turn();
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

      <InspectorPopover
        title="Board overlays"
        open={open}
        anchorEl={trigger}
        onClose={close}
        width={332}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Stack spacing={1.25}>
          <ArrowOverlayControls
            prefs={prefs}
            capabilities={capabilities}
            onChange={update}
            arrows={arrows}
            nameOf={colorNamer}
            turn={turn}
            onFocus={setFocus}
          />

          <Divider />

          <Stack gap={0.25}>
            <PopoverSectionLabel>Display</PopoverSectionLabel>
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
      </InspectorPopover>
    </>
  );
}
