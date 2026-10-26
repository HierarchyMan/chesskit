import { engineLabel } from "@/constants";
import { EngineState } from "@/hooks/useEngine";
import { useModels } from "@/hooks/useModels";
import { describeModel, formatModelSize } from "@/lib/engine/modelStatus";
import { getEngineModel } from "@/lib/engine/models";
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

  if (state.status === "error" && state.missing) {
    return <DownloadChip engineName={engineName} />;
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

/** A side whose engine is not downloaded: one click downloads it, and it starts by itself. */
function DownloadChip({ engineName }: { engineName: EngineId }) {
  const { models, download } = useModels();
  const view = models.find((entry) => entry.model.name === engineName);
  const { label, sizeMb } = getEngineModel(engineName);

  if (view?.progress) {
    return (
      <Chip
        size="small"
        variant="outlined"
        icon={<CircularProgress size={14} thickness={6} />}
        label={`Downloading ${label.small}: ${formatModelSize(view.progress.receivedBytes)} of ${formatModelSize(view.progress.totalBytes)}`}
      />
    );
  }

  return (
    <Tooltip title={view ? describeModel(view).text : ""}>
      <Chip
        size="small"
        color={view?.canDownload ? "primary" : "error"}
        icon={<Icon icon="mdi:download" height={16} />}
        label={
          view?.canDownload
            ? `Download ${label.small} (${sizeMb} MB)`
            : `${label.small} cannot be downloaded here`
        }
        onClick={
          view?.canDownload ? () => void download(engineName) : undefined
        }
      />
    </Tooltip>
  );
}
