import { EngineModel, getDownloadFiles } from "./models";
import { DownloadState, StoredFile, downloadStateOf } from "./modelStorage";

export type BridgeStatus = "unknown" | "checking" | "up" | "down";

export interface ModelProgress {
  receivedBytes: number;
  totalBytes: number;
}

export type StatusTone = "success" | "error" | "default";

export interface ModelState {
  // Downloaded files kept in this browser.
  stored: ReadonlyMap<string, StoredFile>;
  // Whether this browser can keep downloads at all (HTTPS or localhost, Cache Storage).
  storageSupported: boolean;
  // Live engine instances in this tab.
  running: number;
  progress?: ModelProgress;
  error?: string;
  bridge: BridgeStatus;
  // What the bridge said about this native engine's program, when it is running.
  bridgeEngine?: { available: boolean; error?: string };
  supported: boolean;
}

export interface ModelView {
  model: EngineModel;
  supported: boolean;
  // Browser engines only: bundled with the app, or downloaded (current or out of date) or not.
  download?: DownloadState;
  storageSupported: boolean;
  storedBytes: number;
  running: boolean;
  progress?: ModelProgress;
  error?: string;
  bridge: BridgeStatus;
  bridgeEngine?: { available: boolean; error?: string };
  // The engine can start right now.
  available: boolean;
  // A download would make it available (missing or out of date, and this browser can store it).
  canDownload: boolean;
}

export const buildModelView = (
  model: EngineModel,
  state: ModelState
): ModelView => {
  const download =
    model.source === "browser"
      ? downloadStateOf(model, state.stored)
      : undefined;
  const ready = download === "bundled" || download === "downloaded";

  return {
    model,
    supported: state.supported,
    download,
    storageSupported: state.storageSupported,
    storedBytes: getDownloadFiles(model).reduce(
      (total, file) => total + (state.stored.get(file)?.bytes ?? 0),
      0
    ),
    running: state.running > 0,
    progress: state.progress,
    error: state.error,
    bridge: state.bridge,
    bridgeEngine: state.bridgeEngine,
    available:
      model.source === "bridge"
        ? state.bridge === "up" && state.bridgeEngine?.available !== false
        : state.supported && (model.source === "builtin" || ready),
    canDownload:
      state.supported &&
      state.storageSupported &&
      !state.progress &&
      (download === "missing" || download === "outdated"),
  };
};

const MEGABYTE = 1024 * 1024;

export const formatModelSize = (bytes: number): string => {
  const megabytes = bytes / MEGABYTE;
  return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`;
};

const BRIDGE_LINES: Record<BridgeStatus, { text: string; tone: StatusTone }> = {
  unknown: { text: "Bridge status unknown", tone: "default" },
  checking: { text: "Checking the bridge…", tone: "default" },
  up: { text: "Bridge running", tone: "success" },
  down: { text: "Bridge not running", tone: "error" },
};

// "In use": an instance of this engine runs in this tab right now.
const withRunning = (
  view: ModelView,
  line: { text: string; tone: StatusTone }
) => (view.running ? { ...line, text: `${line.text} · In use` } : line);

export const describeModel = (
  view: ModelView
): { text: string; tone: StatusTone } => {
  if (view.model.source === "builtin") {
    return withRunning(view, {
      text: view.model.needsAdvisor
        ? "Built in · asks the advisor engine"
        : "Built in · instant",
      tone: "success",
    });
  }

  if (view.model.source === "bridge") {
    if (view.bridge === "up" && view.bridgeEngine?.available === false) {
      return {
        text: view.bridgeEngine.error ?? "Bridge running, program missing",
        tone: "error",
      };
    }
    return withRunning(view, BRIDGE_LINES[view.bridge]);
  }

  if (!view.supported) {
    return {
      text: "Needs WebAssembly, which this browser lacks",
      tone: "error",
    };
  }

  if (view.progress) {
    return {
      text: `Downloading ${formatModelSize(view.progress.receivedBytes)} of ${formatModelSize(view.progress.totalBytes)}…`,
      tone: "default",
    };
  }

  if (view.error) {
    return { text: `Download failed: ${view.error}`, tone: "error" };
  }

  switch (view.download) {
    case "bundled":
      return withRunning(view, {
        text: `Comes with the app · ${view.model.sizeMb} MB`,
        tone: "success",
      });
    case "downloaded":
      return withRunning(view, {
        text: `Downloaded · ${formatModelSize(view.storedBytes)}`,
        tone: "success",
      });
    default:
      if (!view.storageSupported) {
        return {
          text: "Needs a download, which this browser cannot keep (HTTPS or localhost only)",
          tone: "error",
        };
      }
      return view.download === "outdated"
        ? {
            text: `Downloaded copy is out of date · ${view.model.sizeMb} MB to update`,
            tone: "error",
          }
        : {
            text: `Not downloaded · ${view.model.sizeMb} MB`,
            tone: "default",
          };
  }
};
