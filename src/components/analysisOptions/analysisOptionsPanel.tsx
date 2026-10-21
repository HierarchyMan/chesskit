import Panel from "@/components/panel";
import {
  ANALYSIS_OPTIONS,
  AnalysisOption,
  AnalysisOptionAtoms,
} from "@/lib/analysisOptions";
import {
  Box,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { useAtom } from "jotai";
import { ReactNode } from "react";

export interface AnalysisOptionCopy {
  label: string;
  help?: string;
}

interface Props {
  atoms: AnalysisOptionAtoms;
  copy: Record<AnalysisOption, AnalysisOptionCopy>;
  /** Shown under an option only while its switch is on. */
  details?: Partial<Record<AnalysisOption, ReactNode>>;
  footer?: ReactNode;
}

export default function AnalysisOptionsPanel({
  atoms,
  copy,
  details,
  footer,
}: Props) {
  return (
    <Panel title="Analysis options">
      <Stack spacing={0.5}>
        {ANALYSIS_OPTIONS.map((option) => (
          <OptionSwitch
            key={option}
            atom={atoms[option]}
            copy={copy[option]}
            detail={details?.[option]}
          />
        ))}
        {footer}
      </Stack>
    </Panel>
  );
}

function OptionSwitch({
  atom,
  copy,
  detail,
}: {
  atom: AnalysisOptionAtoms[AnalysisOption];
  copy: AnalysisOptionCopy;
  detail?: ReactNode;
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
        label={copy.label}
      />
      {copy.help && (
        <Typography variant="caption" sx={{ opacity: 0.7, pl: 5 }}>
          {copy.help}
        </Typography>
      )}
      {checked && detail && <Box sx={{ pl: 5 }}>{detail}</Box>}
    </>
  );
}
