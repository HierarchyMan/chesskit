import { DEFAULT_ENGINE } from "@/constants";
import { useModels } from "@/hooks/useModels";
import { formatModelSize } from "@/lib/engine/modelStatus";
import { MissingReason } from "@/lib/engine/modelStorage";
import {
  engineLabel,
  getDownloadHosts,
  getEngineModel,
} from "@/lib/engine/models";
import { EngineState } from "@/hooks/useEngine";
import { EngineId } from "@/types/enums";
import { Icon } from "@iconify/react";
import { Alert, Box, Button, Stack } from "@mui/material";

/**
 * An engine that did not start: the download prompt when it is not downloaded,
 * otherwise the error with a retry.
 */
export function EngineFailureAlert({
  state,
  message,
  retryLabel = "Retry",
  onUseDefault,
}: {
  state: EngineState;
  // Shown instead of the engine's own error, when the caller words it better.
  message?: string;
  retryLabel?: string;
  onUseDefault?: () => void;
}) {
  if (state.missing && state.wanted) {
    return (
      <EngineDownloadAlert
        engineName={state.wanted}
        missing={state.missing}
        onUseDefault={onUseDefault}
      />
    );
  }

  return (
    <Alert
      severity="error"
      sx={{ width: "100%" }}
      action={
        <Button color="inherit" size="small" onClick={state.retry}>
          {retryLabel}
        </Button>
      }
    >
      {message ?? state.error ?? "The engine did not start."}
    </Alert>
  );
}

interface Props {
  engineName: EngineId;
  missing: MissingReason;
  // Switches this part of the app to the engine that comes with the app.
  onUseDefault?: () => void;
}

/**
 * Shown where an engine was chosen that the user has not downloaded. Nothing
 * downloads until they press the button; the engine then starts by itself.
 */
export default function EngineDownloadAlert({
  engineName,
  missing,
  onUseDefault,
}: Props) {
  const { models, download } = useModels();
  const view = models.find((entry) => entry.model.name === engineName);
  const model = getEngineModel(engineName);
  const label = model.label.small;
  const progress = view?.progress;
  const failed = view?.error;

  const useDefault = onUseDefault && engineName !== DEFAULT_ENGINE && (
    <Button color="inherit" size="small" onClick={onUseDefault}>
      Use {engineLabel(DEFAULT_ENGINE).small}
    </Button>
  );

  if (missing === "unsupported" || !view?.storageSupported) {
    return (
      <Alert severity="error" sx={{ width: "100%" }}>
        {label} has to be downloaded, and this browser cannot keep downloads
        here: that needs HTTPS or localhost. Pick an engine that comes with the
        app.
        {useDefault && <Box mt={1}>{useDefault}</Box>}
      </Alert>
    );
  }

  const text = progress
    ? `Downloading ${label}: ${formatModelSize(progress.receivedBytes)} of ${formatModelSize(progress.totalBytes)}…`
    : failed
      ? `Downloading ${label} failed: ${failed}`
      : missing === "outdated"
        ? `The downloaded copy of ${label} is out of date. Download it again to use it.`
        : `${label} is not downloaded. It is ${model.sizeMb} MB from ${getDownloadHosts(model).join(" and ")}, checked against its published SHA-256 and kept in this browser.`;

  // The buttons sit under the text and wrap, so the prompt fits a narrow panel.
  return (
    <Alert
      severity={failed ? "error" : "info"}
      data-engine-download={engineName}
      sx={{ width: "100%", "& .MuiAlert-message": { minWidth: 0 } }}
    >
      {text}
      <Stack direction="row" gap={1} mt={1} flexWrap="wrap">
        <Button
          variant="outlined"
          color="inherit"
          size="small"
          disabled={!!progress}
          startIcon={<Icon icon="mdi:download" height={18} />}
          onClick={() => void download(engineName)}
        >
          {progress
            ? "Downloading…"
            : failed
              ? "Retry"
              : `Download ${model.sizeMb} MB`}
        </Button>
        {!progress && useDefault}
      </Stack>
    </Alert>
  );
}
