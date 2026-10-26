import ModelMenuLabel, { statusColor } from "@/components/modelMenuLabel";
import { DEFAULT_ENGINE, engineLabel } from "@/constants";
import { EngineUsage, useEngineUsage } from "@/hooks/useEngine";
import { useModels } from "@/hooks/useModels";
import { BRIDGE_ORIGIN } from "@/lib/engine/bridge";
import {
  ModelView,
  describeModel,
  formatModelSize,
} from "@/lib/engine/modelStatus";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
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
      <EnginesInUse models={models} onDownload={download} />

      <Stack spacing={1.5}>
        <Typography variant="subtitle2">Browser engines</Typography>
        <Typography variant="body2">
          {engineLabel(DEFAULT_ENGINE).full} comes with the app and works right
          away. Every other browser engine is your download: press Download and
          it is fetched from its original public source, checked against its
          published SHA-256 and kept in this browser, offline included. Nothing
          downloads until you ask, and an engine you have not downloaded does
          not run. Joke engines are built in.
        </Typography>

        {!storageSupported && (
          <Alert severity="info">
            Downloads need HTTPS or localhost and a browser with Cache Storage
            and service workers, so here only{" "}
            {engineLabel(DEFAULT_ENGINE).small}, the joke engines and bridge
            engines can run.
          </Alert>
        )}

        <Typography variant="caption" sx={{ opacity: 0.75 }}>
          Downloaded into this browser:{" "}
          {storedBytes > 0 ? formatModelSize(storedBytes) : "nothing yet"}
        </Typography>
      </Stack>

      <Stack>
        {browserModels.map((view) => (
          <BrowserModelRow
            key={view.model.name}
            view={view}
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
          Native engines run on your own computer, never on the server that
          hosts this app: you run the bridge and provide the engines. The app
          always looks for the bridge at <b>{BRIDGE_ORIGIN}</b> on this
          computer. It listens only there and only accepts this app. They are
          the strongest option: they can use every core and lots of memory.
        </Typography>
        <Typography variant="body2">
          Start the bridge with <b>start-reckless-bridge.bat</b>, or{" "}
          <b>start-chess.bat</b> to start it with the app. To add an engine, put
          its program in the <b>engines</b> folder and add an entry to{" "}
          <b>engines/engines.json</b> (id, name, path, and optionally elo). If
          you open the app from an address other than localhost:3000, add that
          address to <b>allowedOrigins</b> in the same file. Then press Check
          bridge.
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

const usageLine = (
  usage: EngineUsage,
  view: ModelView | undefined
): { text: string; tone: "success" | "error" | "default" } => {
  if (usage.status === "ready") return { text: "Running", tone: "success" };
  if (usage.status === "loading") return { text: "Starting…", tone: "default" };
  if (usage.missing === "outdated") {
    return { text: "Not running: its download is out of date", tone: "error" };
  }
  if (usage.missing) {
    return {
      text: view?.progress
        ? `Not running yet: downloading ${formatModelSize(view.progress.receivedBytes)} of ${formatModelSize(view.progress.totalBytes)}`
        : "Not running: not downloaded",
      tone: "error",
    };
  }
  return {
    text: `Not running: ${usage.error ?? "the engine did not start"}`,
    tone: "error",
  };
};

/** Which engine each open part of the app asked for, and whether that engine runs. */
function EnginesInUse({
  models,
  onDownload,
}: {
  models: ModelView[];
  onDownload: (name: ModelView["model"]["name"]) => void;
}) {
  const usage = Object.values(useEngineUsage()).sort((a, b) =>
    a.purpose.localeCompare(b.purpose)
  );

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">In use now</Typography>
      <Typography variant="body2" sx={{ opacity: 0.75 }}>
        The engine each part of this page asked for, and whether it is the one
        running. An engine runs only when it comes with the app, is downloaded,
        or is on the bridge.
      </Typography>
      {usage.length === 0 && (
        <Typography variant="body2" sx={{ opacity: 0.75 }}>
          No engine is in use on this page.
        </Typography>
      )}
      {usage.map((entry) => {
        const view = models.find((model) => model.model.name === entry.wanted);
        const line = usageLine(entry, view);
        return (
          <Stack
            key={`${entry.purpose}-${entry.wanted}`}
            direction="row"
            alignItems="center"
            gap={1.5}
            data-engine-usage={entry.purpose}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="body2">
                <b>{entry.purpose}</b> wants {engineLabel(entry.wanted).full}
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: "block", color: statusColor(line.tone) }}
              >
                {line.text}
              </Typography>
            </Box>
            {entry.missing && view?.canDownload && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Icon icon="mdi:download" height={18} />}
                onClick={() => onDownload(entry.wanted)}
              >
                {view.model.sizeMb} MB
              </Button>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}

function BrowserModelRow({
  view,
  onDownload,
  onRemove,
}: {
  view: ModelView;
  onDownload: () => void;
  onRemove: () => void;
}) {
  const downloading = !!view.progress;
  const label = engineLabel(view.model.name).full;

  return (
    <Stack direction="row" alignItems="center" gap={1.5} py={1.25}>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <ModelMenuLabel view={view} />
      </Box>

      {view.download === "bundled" ? (
        <Chip size="small" variant="outlined" label="Comes with the app" />
      ) : view.download === "downloaded" ? (
        <Button
          size="small"
          color="inherit"
          variant="outlined"
          startIcon={<Icon icon="mdi:delete-outline" height={18} />}
          disabled={downloading}
          onClick={onRemove}
          aria-label={`Remove ${label} from this browser`}
        >
          Remove
        </Button>
      ) : (
        <Button
          size="small"
          variant="outlined"
          startIcon={<Icon icon="mdi:download" height={18} />}
          disabled={!view.canDownload && !view.error}
          onClick={onDownload}
          aria-label={`Download ${label}`}
        >
          {downloading
            ? "Downloading…"
            : view.error
              ? "Retry"
              : view.download === "outdated"
                ? "Update"
                : "Download"}
        </Button>
      )}
    </Stack>
  );
}
