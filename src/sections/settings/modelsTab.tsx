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
  Collapse,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect } from "react";
import { useAtom } from "jotai";
import { modelsBridgeDocsOpenAtom } from "../layout/states";

export default function ModelsTab() {
  const { models, storageSupported, storedBytes, refresh, download, remove } =
    useModels();
  const [bridgeDocsOpen, setBridgeDocsOpen] = useAtom(modelsBridgeDocsOpenAtom);

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
        <Stack
          direction="row"
          alignItems="baseline"
          justifyContent="space-between"
          gap={1}
          flexWrap="wrap"
        >
          <Typography variant="subtitle2" fontWeight={700}>
            Browser engines
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            Downloaded:{" "}
            {storedBytes > 0 ? formatModelSize(storedBytes) : "None yet"}
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          {engineLabel(DEFAULT_ENGINE).full} is bundled and works right away.
          Extra browser engines download on demand and are cached locally for
          offline play.
        </Typography>

        {!storageSupported && (
          <Alert severity="info">
            Downloads require HTTPS or localhost with Cache Storage and service
            workers. Here only {engineLabel(DEFAULT_ENGINE).small}, joke
            engines, and bridge engines can run.
          </Alert>
        )}

        <Stack divider={<Divider flexItem />}>
          {browserModels.map((view) => (
            <BrowserModelRow
              key={view.model.name}
              view={view}
              onDownload={() => download(view.model.name)}
              onRemove={() => remove(view.model.name)}
            />
          ))}
        </Stack>
      </Stack>

      <Stack spacing={1.5}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          flexWrap="wrap"
        >
          <Button
            size="small"
            color="inherit"
            aria-expanded={bridgeDocsOpen}
            onClick={() => setBridgeDocsOpen((prev) => !prev)}
            endIcon={
              <Icon
                icon={bridgeDocsOpen ? "mdi:chevron-up" : "mdi:chevron-down"}
                height={18}
              />
            }
            sx={{ px: 0.75, fontWeight: 700 }}
          >
            Local native engine bridge (Advanced)
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Icon icon="mdi:refresh" height={16} />}
            onClick={() => refresh()}
            disabled={bridge === "checking"}
          >
            Check bridge
          </Button>
        </Stack>

        <Collapse in={bridgeDocsOpen}>
          <Stack
            spacing={1}
            sx={{
              p: 1.5,
              borderRadius: 1,
              border: 1,
              borderColor: "divider",
              bgcolor: "action.hover",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Native engines run on your own computer via a local bridge at{" "}
              <b>{BRIDGE_ORIGIN}</b>, allowing full multi-core CPU speed and
              large hash tables.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start the bridge with <b>start-reckless-bridge.bat</b> (or{" "}
              <b>start-chess.bat</b>). To add an engine, place its binary in{" "}
              <b>engines/</b> and register it in <b>engines/engines.json</b>{" "}
              (id, name, path, optional elo). If opening from another origin
              than localhost:3000, add it to <b>allowedOrigins</b>, then press
              Check bridge.
            </Typography>
          </Stack>
        </Collapse>

        <Stack divider={<Divider flexItem />}>
          {natives.map((view) => {
            const status = describeModel(view);
            return (
              <Stack key={view.model.name} py={1}>
                <Typography variant="body2" fontWeight={600}>
                  {view.model.label.full}
                </Typography>
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
        ? `Downloading ${formatModelSize(view.progress.receivedBytes)} of ${formatModelSize(view.progress.totalBytes)}`
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
      <Typography variant="subtitle2" fontWeight={700}>
        In use now
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Active engines requested by the current page.
      </Typography>
      {usage.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No engine is active on this page.
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
                <b>{entry.purpose}</b> · {engineLabel(entry.wanted).full}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  color: statusColor(line.tone),
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {line.text}
              </Typography>
            </Box>
            {entry.missing && view?.canDownload && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Icon icon="mdi:download" height={16} />}
                onClick={() => onDownload(entry.wanted)}
                sx={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}
              >
                Download ({view.model.sizeMb} MB)
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
  const progress = view.progress;
  const downloading = !!progress;
  const label = engineLabel(view.model.name).full;
  const pct =
    progress && progress.totalBytes > 0
      ? Math.min(
          100,
          Math.round((progress.receivedBytes / progress.totalBytes) * 100)
        )
      : undefined;

  return (
    <Stack spacing={0.75} py={1.25}>
      <Stack direction="row" alignItems="center" gap={1.5}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <ModelMenuLabel view={view} />
        </Box>

        {view.download === "bundled" ? (
          <Box
            sx={{
              px: 1.25,
              py: 0.4,
              borderRadius: 999,
              bgcolor: "action.selected",
              color: "text.secondary",
              fontSize: "0.75rem",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            Bundled
          </Box>
        ) : view.download === "downloaded" ? (
          <Button
            size="small"
            color="inherit"
            variant="outlined"
            startIcon={<Icon icon="mdi:delete-outline" height={16} />}
            disabled={downloading}
            onClick={onRemove}
            aria-label={`Remove ${label} from this browser`}
            sx={{ flexShrink: 0 }}
          >
            Remove
          </Button>
        ) : (
          <Button
            size="small"
            variant="outlined"
            startIcon={<Icon icon="mdi:download" height={16} />}
            disabled={!view.canDownload && !view.error}
            onClick={onDownload}
            aria-label={`Download ${label}`}
            sx={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}
          >
            {downloading
              ? pct !== undefined
                ? `Downloading (${pct}%)`
                : "Downloading…"
              : view.error
                ? "Retry"
                : view.download === "outdated"
                  ? `Update (${view.model.sizeMb} MB)`
                  : `Download (${view.model.sizeMb} MB)`}
          </Button>
        )}
      </Stack>

      {downloading && (
        <LinearProgress
          variant={pct !== undefined ? "determinate" : "indeterminate"}
          value={pct}
          sx={{ borderRadius: 1, height: 5 }}
        />
      )}
    </Stack>
  );
}
