import { EngineId } from "@/types/enums";
import { BRIDGE_ORIGIN, bridgeEngineUrl, probeBridgeEngine } from "./bridge";
import { EngineRuntimeSettings } from "./engineSettings";
import { createJokeWorker } from "./jokes/jokeWorker";
import { isJokeEngineName } from "./jokes/strategies";
import { EngineModel, getEngineModel } from "./models";
import { requireDownloadedEngine } from "./modelStorage";
import { isModelSupported } from "./shared";
import { EngineSetup, EngineSource, UciEngine } from "./uciEngine";
import { setSpinOption } from "./uciOptions";

export interface CreateEngineOptions {
  signal?: AbortSignal;
  settings: EngineRuntimeSettings;
  // The real engine that judges moves for the joke engines that need one.
  advisor?: { name: EngineId; depth: number };
}

const setupFor =
  (model: EngineModel, settings: EngineRuntimeSettings): EngineSetup =>
  (options) =>
    [
      ...(model.init ?? []),
      setSpinOption(options, "Hash", settings.hashMb),
      model.source === "bridge"
        ? setSpinOption(options, "Threads", settings.threads)
        : undefined,
    ].filter((command): command is string => !!command);

const sourceFor = async (
  model: EngineModel,
  { signal, settings, advisor }: CreateEngineOptions
): Promise<EngineSource> => {
  switch (model.source) {
    case "browser":
      // The app serves only the bundled engine; any other runs from the user's download.
      await requireDownloadedEngine(model);
      return model.script;
    case "bridge": {
      const status = await probeBridgeEngine(model.script, signal);
      if (!status.running) {
        throw new Error(
          `The engine bridge is not running on this computer (${BRIDGE_ORIGIN}). Start it with start-reckless-bridge.bat (or start-chess.bat) and try again.`
        );
      }
      if (!status.available) {
        throw new Error(
          status.error ??
            `The bridge has no program for ${model.label.small}. Check engines/engines.json.`
        );
      }
      return bridgeEngineUrl(model.script);
    }
    case "builtin": {
      const name = model.name;
      if (!isJokeEngineName(name)) {
        throw new Error(`${model.label.small} has no builtin implementation`);
      }
      if (model.needsAdvisor && !advisor) {
        throw new Error(`${model.label.small} needs an advisor engine`);
      }
      return () =>
        createJokeWorker(name, {
          advisorDepth: advisor?.depth ?? 1,
          startAdvisor:
            model.needsAdvisor && advisor
              ? () => createEngine(advisor.name, { settings })
              : undefined,
        });
    }
  }
};

/** Starts any engine of the registry, ready for UCI. */
export const createEngine = async (
  name: EngineId,
  options: CreateEngineOptions
): Promise<UciEngine> => {
  const model = getEngineModel(name);
  if (!isModelSupported(model)) {
    throw new Error(
      `${model.label.small} needs WebAssembly, which this browser lacks.`
    );
  }
  if (model.needsAdvisor && options.advisor) {
    const advisorModel = getEngineModel(options.advisor.name);
    if (!advisorModel.roles.analysis) {
      throw new Error(
        `${advisorModel.label.small} cannot judge moves for ${model.label.small}. Pick a real engine as the joke engines' advisor.`
      );
    }
  }

  const source = await sourceFor(model, options);
  return UciEngine.create(
    name,
    source,
    setupFor(model, options.settings),
    options.signal
  );
};
