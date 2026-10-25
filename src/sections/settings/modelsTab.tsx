import ModelMenuLabel, { statusColor } from "@/components/modelMenuLabel";
import { engineLabel } from "@/constants";
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
  const natives = models.filter((view) => view.model.source === "bridge");
  const bridge = natives[0]?.bridge ?? "unknown";

  return (
    <Stack spacing={2.5} divider={<Divider flexItem />}>
      <Stack spacing={1.5}>
        <Typography variant="body2">
          Browser engines (Stockfish, Lozza, tomitankChess) run in this page.
          Download one to keep a copy on this device, so it loads faster and
          works offline. Joke engines are built in and need no download.
          Removing a download frees space only: the engine still loads from the
          server when you use it online.
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

      <Stack spacing={1.5}>
        <Typography variant="subtitle2">
          Native engines (local bridge)
        </Typography>
        <Typography variant="body2">
          Native engines run outside the browser through a small local bridge,
          which listens only on this computer and only accepts this app. They
          are the strongest option: they can use every core and lots of memory.
        </Typography>
        <Typography variant="body2">
          Start the bridge with <b>start-reckless-bridge.bat</b>, or{" "}
          <b>start-chess.bat</b> to start it with the app. To add an engine, put
          its program in the <b>engines</b> folder and add an entry to{" "}
          <b>engines/engines.json</b> (id, name, path, and optionally elo). Then
          press Check bridge.
        </Typography>
        <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
          <Button
            variant="outlined"
            onClick={() => refresh()}
            disabled={bridge === "checking"}
          >
            Check bridge
          </Button>
        </Stack>
        <Stack>
          {natives.map((view) => {
            const status = describeModel(view);
            return (
              <Stack key={view.model.name} py={1}>
                <Typography variant="body1">{view.model.label.full}</Typography>
                <Typography
                  variant="caption"
                  sx={{ color: statusColor(status.tone) }}
                >
                  {status.text}
                </Typography>
              </Stack>
            );
          })}
        </Stack>
      </Stack>
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
          aria-label={`Remove ${engineLabel(view.model.name).full} from this device`}
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
          aria-label={`Download ${engineLabel(view.model.name).full}`}
        >
          {downloading ? "Downloading…" : view.error ? "Retry" : "Download"}
        </Button>
      )}
    </Stack>
  );
}
