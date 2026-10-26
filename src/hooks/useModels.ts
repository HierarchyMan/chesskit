import { BridgeListing, fetchBridgeListing } from "@/lib/engine/bridge";
import {
  BridgeStatus,
  ModelProgress,
  buildModelView,
} from "@/lib/engine/modelStatus";
import {
  getAllDownloadFiles,
  getAllEngineModels,
  getDownloadFiles,
  getEngineFile,
  getEngineModel,
  getRemovableFiles,
  setNativeEngines,
} from "@/lib/engine/models";
import {
  StoredFile,
  downloadModelFiles,
  isFileCurrent,
  isModelStorageSupported,
  readStoredFiles,
  registerModelCacheWorker,
  removeModelFiles,
} from "@/lib/engine/modelStorage";
import { isModelSupported } from "@/lib/engine/shared";
import { EngineId } from "@/types/enums";
import {
  atom,
  createStore,
  getDefaultStore,
  useAtomValue,
  useStore,
} from "jotai";
import { useCallback, useMemo } from "react";

type Store = ReturnType<typeof createStore>;
type PerEngine<T> = Partial<Record<EngineId, T>>;

const bridgeAtom = atom<BridgeStatus>("unknown");
const bridgeListingAtom = atom<BridgeListing | undefined>(undefined);
export const storedFilesAtom = atom<ReadonlyMap<string, StoredFile>>(new Map());
const runningCountsAtom = atom<PerEngine<number>>({});
const progressAtom = atom<PerEngine<ModelProgress>>({});
const errorsAtom = atom<PerEngine<string>>({});

// Called by useEngineState when an engine starts (+1) or is shut down (-1).
export const markEngineRunningAtom = atom(
  null,
  (get, set, update: { name: EngineId; delta: 1 | -1 }) => {
    const counts = get(runningCountsAtom);
    set(runningCountsAtom, {
      ...counts,
      [update.name]: (counts[update.name] ?? 0) + update.delta,
    });
  }
);

const withEntry = <T>(
  record: PerEngine<T>,
  name: EngineId,
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
  store.set(storedFilesAtom, await readStoredFiles(getAllDownloadFiles()));
};

/** Starts the engine store once, at app start: the cache worker, old downloads, then the file list. */
export const startModelStorage = async (): Promise<void> => {
  await registerModelCacheWorker();
  await readStorage(getDefaultStore()).catch((reason) => console.error(reason));
};

const probeBridge = async (store: Store): Promise<void> => {
  store.set(bridgeAtom, "checking");
  const listing = await fetchBridgeListing();
  // Native engines are known only from the bridge, so the registry follows its listing.
  if (listing) setNativeEngines(listing.engines);
  store.set(bridgeListingAtom, listing);
  store.set(bridgeAtom, listing ? "up" : "down");
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

const downloadModel = async (store: Store, name: EngineId): Promise<void> => {
  const model = getEngineModel(name);
  if (
    model.source !== "browser" ||
    model.bundled ||
    store.get(progressAtom)[name]
  ) {
    return;
  }

  const setError = (message: string | undefined) =>
    store.set(errorsAtom, withEntry(store.get(errorsAtom), name, message));
  const setProgress = (progress: ModelProgress | undefined) =>
    store.set(progressAtom, withEntry(store.get(progressAtom), name, progress));

  setError(undefined);
  if (!isModelStorageSupported()) {
    setError(
      "This browser cannot keep downloads here (HTTPS or localhost only)."
    );
    return;
  }

  // Set before the first await so a second click cannot start a parallel download.
  setProgress({ receivedBytes: 0, totalBytes: 0 });
  try {
    const files = getDownloadFiles(model);
    const stored = await readStoredFiles(files);
    // Out-of-date copies are fetched again, current ones are kept.
    const needed = files.filter((file) => !isFileCurrent(file, stored));
    const totalBytes = needed.reduce(
      (total, file) => total + getEngineFile(file).bytes,
      0
    );

    setProgress({ receivedBytes: 0, totalBytes });
    await downloadModelFiles(needed, (receivedBytes) =>
      setProgress({ receivedBytes, totalBytes })
    );
  } catch (error) {
    setError(error instanceof Error ? error.message : "Unknown error");
  } finally {
    setProgress(undefined);
    await readStorage(store);
  }
};

const removeModel = async (store: Store, name: EngineId): Promise<void> => {
  const model = getEngineModel(name);
  if (model.source !== "browser" || store.get(progressAtom)[name]) return;

  const stored = await readStoredFiles(getAllDownloadFiles());
  await removeModelFiles(getRemovableFiles(name, stored));

  store.set(errorsAtom, withEntry(store.get(errorsAtom), name, undefined));
  await readStorage(store);
};

export const useModels = () => {
  const store = useStore();
  const bridge = useAtomValue(bridgeAtom);
  const listing = useAtomValue(bridgeListingAtom);
  const stored = useAtomValue(storedFilesAtom);
  const runningCounts = useAtomValue(runningCountsAtom);
  const progress = useAtomValue(progressAtom);
  const errors = useAtomValue(errorsAtom);
  const storageSupported = isModelStorageSupported();

  const models = useMemo(
    () =>
      getAllEngineModels().map((model) =>
        buildModelView(model, {
          bridgeEngine:
            model.source === "bridge" && listing
              ? (listing.engines.find((entry) => entry.id === model.script) ?? {
                  available: false,
                  error: "Not listed in engines/engines.json",
                })
              : undefined,
          stored,
          storageSupported,
          running: runningCounts[model.name] ?? 0,
          progress: progress[model.name],
          error: errors[model.name],
          bridge,
          supported: isModelSupported(model),
        })
      ),
    [stored, storageSupported, runningCounts, progress, errors, bridge, listing]
  );

  const refresh = useCallback(() => refreshModels(store), [store]);
  const download = useCallback(
    (name: EngineId) => downloadModel(store, name),
    [store]
  );
  const remove = useCallback(
    (name: EngineId) => removeModel(store, name),
    [store]
  );

  const storedBytes = useMemo(
    () => [...stored.values()].reduce((total, file) => total + file.bytes, 0),
    [stored]
  );

  return {
    models,
    bridge,
    storedBytes,
    storageSupported,
    refresh,
    download,
    remove,
  };
};
