import ModelMenuLabel, { statusColor } from "@/components/modelMenuLabel";
import { ENGINE_LABELS } from "@/constants";
import { useModels } from "@/hooks/useModels";
import {
  ModelView,
  describeModel,
  formatModelSize,
} from "@/lib/engine/modelStatus";
import { Icon } from "@iconify/react";
import { Alert, Box, Button, Divider, Stack, Typography } from "@mui/material";
import { useEffect } from "react";

export default function ModelsTab() {
  const { models, storageSupported, storedBytes, refresh, download, remove } =
    useModels();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const browserModels = models.filter(
    (view) => view.model.source === "browser"
  );
  const reckless = models.find((view) => view.model.source === "bridge");

  return (
    <Stack spacing={2.5} divider={<Divider flexItem />}>
      <Stack spacing={1.5}>
        <Typography variant="body2">
          Stockfish runs in your browser. Download an engine to keep a copy on
          this device, so it loads faster and works offline. Removing a download
          frees space only: the engine still loads from the server when you use
          it online.
        </Typography>

        {!storageSupported && (
          <Alert severity="info">
            Offline downloads need HTTPS or localhost and a browser with Cache
            Storage and service workers. Engines still load over the network.
          </Alert>
        )}

        <Typography variant="caption" sx={{ opacity: 0.75 }}>
          Stored on this device:{" "}
          {storedBytes > 0 ? formatModelSize(storedBytes) : "nothing yet"}
        </Typography>
      </Stack>

      <Stack>
        {browserModels.map((view) => (
          <BrowserModelRow
            key={view.model.name}
            view={view}
            storageSupported={storageSupported}
            onDownload={() => download(view.model.name)}
            onRemove={() => remove(view.model.name)}
          />
        ))}
      </Stack>

      {reckless && (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Reckless (native engine)</Typography>
          <Typography variant="body2">
            Reckless runs outside the browser through a small local bridge. The
            bridge listens only on this computer and only accepts connections
            from this app.
          </Typography>
          <Typography variant="body2">
            To start it, double-click <b>start-reckless-bridge.bat</b>, or use
            <b> start-chess.bat</b> to start the bridge and the app together.
          </Typography>
          <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
            <Button
              variant="outlined"
              onClick={() => refresh()}
              disabled={reckless.bridge === "checking"}
            >
              Check bridge
            </Button>
            <Typography
              variant="body2"
              sx={{ color: statusColor(describeModel(reckless).tone) }}
            >
              {describeModel(reckless).text}
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            Reckless is installed on this computer, so it cannot be downloaded
            here. The bridge only starts when its engine file is present, so a
            running bridge means Reckless is available. The bridge does not
            report the file size.
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}

function BrowserModelRow({
  view,
  storageSupported,
  onDownload,
  onRemove,
}: {
  view: ModelView;
  storageSupported: boolean;
  onDownload: () => void;
  onRemove: () => void;
}) {
  const downloading = !!view.progress;
  const canDownload = storageSupported && view.supported;

  return (
    <Stack direction="row" alignItems="center" gap={1.5} py={1.25}>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <ModelMenuLabel view={view} />
      </Box>

      {view.downloaded ? (
        <Button
          size="small"
          color="inherit"
          variant="outlined"
          startIcon={<Icon icon="mdi:delete-outline" height={18} />}
          disabled={downloading}
          onClick={onRemove}
          aria-label={`Remove ${ENGINE_LABELS[view.model.name].full} from this device`}
        >
          Remove
        </Button>
      ) : (
        <Button
          size="small"
          variant="outlined"
          startIcon={<Icon icon="mdi:download" height={18} />}
          disabled={!canDownload || downloading}
          onClick={onDownload}
          aria-label={`Download ${ENGINE_LABELS[view.model.name].full}`}
        >
          {downloading ? "Downloading…" : view.error ? "Retry" : "Download"}
        </Button>
      )}
    </Stack>
  );
}
