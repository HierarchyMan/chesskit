import { engineLabel } from "@/constants";
import { EngineState } from "@/hooks/useEngine";
import { EngineId } from "@/types/enums";
import { Icon } from "@iconify/react";
import { Chip, CircularProgress, Tooltip } from "@mui/material";

interface Props {
  state: EngineState;
  engineName: EngineId;
}

export default function EngineStatusChip({ state, engineName }: Props) {
  if (state.status === "loading") {
    return (
      <Chip
        size="small"
        variant="outlined"
        icon={<CircularProgress size={14} thickness={6} />}
        label={`Loading ${engineLabel(engineName).small}…`}
      />
    );
  }

  if (state.status === "error") {
    return (
      <Tooltip title={state.error ?? "The engine did not start."}>
        <Chip
          size="small"
          color="error"
          icon={<Icon icon="mdi:alert-circle-outline" height={16} />}
          label={`${engineLabel(engineName).small} unavailable. Retry`}
          onClick={state.retry}
        />
      </Tooltip>
    );
  }

  return null;
}
