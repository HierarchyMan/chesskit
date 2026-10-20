import { ENGINE_LABELS } from "@/constants";
import { EngineState } from "@/hooks/useEngine";
import { EngineName } from "@/types/enums";
import { Icon } from "@iconify/react";
import { Chip, CircularProgress, Tooltip } from "@mui/material";

interface Props {
  state: EngineState;
  engineName: EngineName;
}

export default function EngineStatusChip({ state, engineName }: Props) {
  if (state.status === "loading") {
    return (
      <Chip
        size="small"
        variant="outlined"
        icon={<CircularProgress size={14} thickness={6} />}
        label={`Loading ${ENGINE_LABELS[engineName].small}…`}
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
          label={`${ENGINE_LABELS[engineName].small} unavailable. Retry`}
          onClick={state.retry}
        />
      </Tooltip>
    );
  }

  return null;
}
