import { probeRecklessBridge } from "@/lib/engine/reckless";
import {
  BridgeStatus,
  ModelProgress,
  buildModelView,
} from "@/lib/engine/modelStatus";
import {
  ENGINE_MODELS,
  getAllModelFiles,
  getEngineModel,
  getModelFiles,
  getRemovableFiles,
} from "@/lib/engine/models";
import {
  downloadModelFiles,
  isModelStorageSupported,
  readStoredFiles,
  removeModelFiles,
} from "@/lib/engine/modelStorage";
import { isEngineSupported } from "@/lib/engine/shared";
import { EngineName } from "@/types/enums";
import { atom, createStore, useAtomValue, useStore } from "jotai";
import { useCallback, useMemo } from "react";

type Store = ReturnType<typeof createStore>;
type PerEngine<T> = Partial<Record<EngineName, T>>;

const bridgeAtom = atom<BridgeStatus>("unknown");
const storedFilesAtom = atom<ReadonlyMap<string, number>>(new Map());
const loadedCountsAtom = atom<PerEngine<number>>({});
const progressAtom = atom<PerEngine<ModelProgress>>({});
const errorsAtom = atom<PerEngine<string>>({});

// Called by useEngineState when an engine starts (+1) or is shut down (-1).
export const markEngineLoadedAtom = atom(
  null,
  (get, set, update: { name: EngineName; delta: 1 | -1 }) => {
    const counts = get(loadedCountsAtom);
    set(loadedCountsAtom, {
      ...counts,
      [update.name]: (counts[update.name] ?? 0) + update.delta,
    });
  }
);

const withEntry = <T>(
  record: PerEngine<T>,
  name: EngineName,
  value: T | undefined
): PerEngine<T> => {
  const next = { ...record };
  if (value === undefined) {
    delete next[name];
  } else {
    next[name] = value;
  }
  return next;
};

const readStorage = async (store: Store): Promise<void> => {
  store.set(storedFilesAtom, await readStoredFiles(getAllModelFiles()));
};

const probeBridge = async (store: Store): Promise<void> => {
  store.set(bridgeAtom, "checking");
  store.set(bridgeAtom, (await probeRecklessBridge()) ? "up" : "down");
};

let refreshing: Promise<void> | undefined;

// Menus call this on open. Overlapping calls share one measurement.
const refreshModels = (store: Store): Promise<void> => {
  refreshing ??= Promise.all([readStorage(store), probeBridge(store)])
    .then(() => undefined)
    .catch((reason) => console.error(reason))
    .finally(() => {
      refreshing = undefined;
    });

  return refreshing;
};

const downloadModel = async (store: Store, name: EngineName): Promise<void> => {
  const model = getEngineModel(name);
  if (model.source !== "browser" || store.get(progressAtom)[name]) return;

  const setError = (message: string | undefined) =>
    store.set(errorsAtom, withEntry(store.get(errorsAtom), name, message));
  const setProgress = (progress: ModelProgress | undefined) =>
    store.set(progressAtom, withEntry(store.get(progressAtom), name, progress));

  setError(undefined);
  if (!isModelStorageSupported()) {
    setError("Offline storage is not available in this browser.");
    return;
  }

  // Set before the first await so a second click cannot start a parallel download.
  setProgress({ done: 0, total: 0 });
  try {
    const files = getModelFiles(model);
    const stored = await readStoredFiles(files);
    const missing = files.filter((file) => !stored.has(file));

    setProgress({ done: 0, total: missing.length });
    await downloadModelFiles(missing, (done) =>
      setProgress({ done, total: missing.length })
    );
  } catch (error) {
    setError(error instanceof Error ? error.message : "Unknown error");
  } finally {
    setProgress(undefined);
    await readStorage(store);
  }
};

const removeModel = async (store: Store, name: EngineName): Promise<void> => {
  const model = getEngineModel(name);
  if (model.source !== "browser" || store.get(progressAtom)[name]) return;

  const stored = await readStoredFiles(getAllModelFiles());
  await removeModelFiles(getRemovableFiles(name, stored));

  store.set(errorsAtom, withEntry(store.get(errorsAtom), name, undefined));
  await readStorage(store);
};

export const useModels = () => {
  const store = useStore();
  const bridge = useAtomValue(bridgeAtom);
  const stored = useAtomValue(storedFilesAtom);
  const loadedCounts = useAtomValue(loadedCountsAtom);
  const progress = useAtomValue(progressAtom);
  const errors = useAtomValue(errorsAtom);

  const models = useMemo(
    () =>
      Object.values(ENGINE_MODELS).map((model) =>
        buildModelView(model, {
          stored,
          loaded: loadedCounts[model.name] ?? 0,
          progress: progress[model.name],
          error: errors[model.name],
          bridge,
          supported: isEngineSupported(model.name),
        })
      ),
    [stored, loadedCounts, progress, errors, bridge]
  );

  const refresh = useCallback(() => refreshModels(store), [store]);
  const download = useCallback(
    (name: EngineName) => downloadModel(store, name),
    [store]
  );
  const remove = useCallback(
    (name: EngineName) => removeModel(store, name),
    [store]
  );

  const storedBytes = useMemo(
    () => [...stored.values()].reduce((total, bytes) => total + bytes, 0),
    [stored]
  );

  return {
    models,
    bridge,
    storedBytes,
    storageSupported: isModelStorageSupported(),
    refresh,
    download,
    remove,
  };
};
