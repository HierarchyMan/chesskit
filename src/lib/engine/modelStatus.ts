import { EngineModel, getModelFiles } from "./models";

export type BridgeStatus = "unknown" | "checking" | "up" | "down";

export interface ModelProgress {
  done: number;
  total: number;
}

export type StatusTone = "success" | "error" | "default";

export interface ModelState {
  // Files kept on this device, mapped to their size in bytes.
  stored: ReadonlyMap<string, number>;
  // Live engine instances in this tab.
  loaded: number;
  progress?: ModelProgress;
  error?: string;
  bridge: BridgeStatus;
  supported: boolean;
}

export interface ModelView {
  model: EngineModel;
  supported: boolean;
  // Always false for bridge models: they are installed on the computer, not downloaded.
  downloaded: boolean;
  storedBytes: number;
  loaded: boolean;
  progress?: ModelProgress;
  error?: string;
  bridge: BridgeStatus;
  available: boolean;
}

export const buildModelView = (
  model: EngineModel,
  state: ModelState
): ModelView => {
  const files = getModelFiles(model);

  return {
    model,
    supported: state.supported,
    downloaded:
      model.source === "browser" &&
      files.every((file) => state.stored.has(file)),
    storedBytes: files.reduce(
      (total, file) => total + (state.stored.get(file) ?? 0),
      0
    ),
    loaded: state.loaded > 0,
    progress: state.progress,
    error: state.error,
    bridge: state.bridge,
    available:
      model.source === "bridge" ? state.bridge === "up" : state.supported,
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

export const describeModel = (
  view: ModelView
): { text: string; tone: StatusTone } => {
  if (view.model.source === "bridge") {
    const line = BRIDGE_LINES[view.bridge];
    return view.loaded ? { ...line, text: `${line.text} · Loaded` } : line;
  }

  if (!view.supported) {
    return {
      text: "Needs WebAssembly, which this browser lacks",
      tone: "error",
    };
  }

  if (view.progress) {
    return {
      text: `Downloading ${view.progress.done} of ${view.progress.total} files…`,
      tone: "default",
    };
  }

  if (view.error) {
    return { text: `Download failed: ${view.error}`, tone: "error" };
  }

  const parts = view.downloaded
    ? [`Downloaded · ${formatModelSize(view.storedBytes)}`]
    : [`Not downloaded · about ${view.model.sizeMb} MB`];
  if (view.loaded) parts.push("Loaded");

  return {
    text: parts.join(" · "),
    tone: view.downloaded ? "success" : "default",
  };
};
