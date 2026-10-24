import ArrowOverlay, { OverlayView } from "@/components/board/arrowOverlay";
import { colorNamer } from "@/lib/arrows/legend";
import { ARROW_CAPABILITIES } from "@/lib/arrows/prefs";
import {
  Alert,
  Button,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { useAtom, useAtomValue } from "jotai";
import { useAnalysisEngine } from "./engineContext";
import { AnalysisOverlay } from "./hooks/useAnalysisOverlay";
import { analysisPositionErrorAtom } from "./sessionAtoms";
import { analysisOptionAtoms, boardAtom } from "./states";

const DISPLAY_SWITCHES = [
  {
    atom: analysisOptionAtoms.evaluation,
    label: "Evaluation bar",
    help: "Score bar beside the board. Analysis keeps running while it is hidden.",
  },
  {
    atom: analysisOptionAtoms.annotations,
    label: "Move annotations",
    help: "Each played move's quality icon. Grades in Moves and Graph stay visible.",
  },
];

/** The display switches sit with the overlays, but they are not engine arrows. */
function DisplaySwitches() {
  return (
    <Stack gap={0.5}>
      <Typography variant="body2" fontWeight={600}>
        Display
      </Typography>
      {DISPLAY_SWITCHES.map(({ atom, label, help }) => (
        <DisplaySwitch key={label} atom={atom} label={label} help={help} />
      ))}
    </Stack>
  );
}

function DisplaySwitch({
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
    <>
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={checked}
            onChange={(_, value) => setChecked(value)}
          />
        }
        label={<Typography variant="body2">{label}</Typography>}
      />
      <Typography variant="caption" sx={{ opacity: 0.75, pl: 5 }}>
        {help}
      </Typography>
    </>
  );
}

/** A failed engine start, with its retry, stays in view wherever the overlays are. */
function AnalysisFailure() {
  const error = useAtomValue(analysisPositionErrorAtom);
  const engine = useAnalysisEngine();
  if (!error) return null;
  return (
    <Alert
      severity="error"
      action={<Button onClick={engine.retry}>Retry analysis</Button>}
    >
      {error}
    </Alert>
  );
}

/**
 * The Analysis page's overlay: the arrows' own controls, the display switches
 * and any engine failure. Beside the board it is the inspector; above the board
 * on a narrow screen it is a summary that opens the same controls.
 */
export default function AnalysisOverlayPanel({
  overlay,
  view,
}: {
  overlay: AnalysisOverlay;
  view: OverlayView;
}) {
  const turn = useAtomValue(boardAtom).turn();
  return (
    <ArrowOverlay
      view={view}
      prefs={overlay.prefs}
      capabilities={ARROW_CAPABILITIES.analysis}
      onChange={overlay.update}
      arrows={overlay.arrows}
      nameOf={colorNamer}
      turn={turn}
      onFocus={overlay.setFocus}
      extra={
        <Stack gap={1.5}>
          <DisplaySwitches />
          <AnalysisFailure />
        </Stack>
      }
    />
  );
}
