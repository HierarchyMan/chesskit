import { EngineId, EngineName, NativeEngineId } from "@/types/enums";
import engineFiles from "./engineFiles.json";

/**
 * Every engine the app knows, in one place. Labels, pickers, support checks,
 * downloads and the factory that starts an engine all read this registry, so
 * adding an engine is one entry here plus its files in engineFiles.json.
 */

// "browser": a JavaScript/WebAssembly build run in a Web Worker. The bundled one
// is served by the app; every other one is downloaded by the user into the browser.
// "bridge": a native program on this computer, reached through the local bridge.
// "builtin": written in this app and run in the page (the joke engines).
export type EngineSource = "browser" | "bridge" | "builtin";

export type EngineGroup = "native" | "stockfish" | "other" | "joke";

export interface EngineRating {
  elo: number;
  // "ccrl": CCRL Blitz list of 24 Oct 2026, native single-CPU build.
  // "author": the engine author's own estimate.
  source: "ccrl" | "author";
}

export interface EngineModel {
  name: EngineId;
  label: { full: string; small: string };
  family: string;
  group: EngineGroup;
  description: string;
  source: EngineSource;
  // File under public/ that the worker starts, the bridge route, or the builtin id.
  script: string;
  // Other files that the script loads: WebAssembly binaries, parts and nets.
  assets: string[];
  // Total size of the files in MB, from engineFiles.json. 0 for bridge and builtin engines.
  sizeMb: number;
  // Served by the app itself, so it needs no download. Only browser engines can be.
  bundled: boolean;
  rating?: EngineRating;
  // Where the engine can be picked. Analysis shows its lines and evaluation.
  roles: { analysis: boolean; play: boolean };
  // False when the scores are not a real evaluation (joke engines, random leaf scores).
  // Such engines may run analysis, but features that grade moves never use them.
  reliableEval: boolean;
  needsWasm: boolean;
  // The engine's UCI_Elo range, when it can limit its own strength.
  nativeElo?: { min: number; max: number };
  // Most lines the engine can list at once (its MultiPV maximum, 1 if it has none).
  maxMultiPv: number;
  // UCI commands sent after the handshake, before the first game.
  init?: string[];
  // The engine picks its moves its own way, so bot strength settings do not apply.
  playsOwnMoves?: boolean;
  // Builtin engines that rank moves by another engine's evaluations.
  needsAdvisor?: boolean;
  // How the Node scripts run a browser engine: directly, or inside a Worker shim.
  nodeRunner?: "direct" | "worker";
  tags: string[];
  homepage?: string;
  license?: string;
}

const partFiles = (base: string): string[] =>
  Array.from({ length: 6 }, (_, index) => `${base}-part-${index}.wasm`);

const SF_HOME = "https://stockfishchess.org";
const LOZZA_HOME = "https://github.com/op12no2/lozza";

const BROWSER_ROLES = { analysis: true, play: true };
const SF_ELO = { min: 1320, max: 3190 };

// Size and the bundled flag come from engineFiles.json, never from an entry.
type Entry = Omit<EngineModel, "name" | "sizeMb" | "bundled">;

const stockfish = (entry: Partial<Entry> & Pick<Entry, "label">): Entry => ({
  family: "Stockfish",
  group: "stockfish",
  description: "",
  source: "browser",
  script: "",
  assets: [],
  roles: BROWSER_ROLES,
  reliableEval: true,
  needsWasm: true,
  nativeElo: SF_ELO,
  maxMultiPv: 256,
  nodeRunner: "direct",
  tags: [],
  homepage: SF_HOME,
  license: "GPL-3.0",
  ...entry,
});

const lozza = (
  build: string,
  elo: number,
  description: string,
  extra: Partial<Entry> = {}
): Entry => ({
  label: { full: `Lozza 12 ${build}`, small: `Lozza ${build}` },
  family: "Lozza",
  group: "other",
  description,
  source: "browser",
  script: `engines/lozza/lozza${build}.js`,
  assets: [],
  rating: { elo, source: "author" },
  roles: BROWSER_ROLES,
  reliableEval: true,
  needsWasm: false,
  maxMultiPv: 10,
  nodeRunner: "worker",
  tags: ["Pure JavaScript"],
  homepage: LOZZA_HOME,
  license: "MIT",
  ...extra,
});

const joke = (
  label: string,
  description: string,
  extra: Partial<Entry> = {}
): Entry => ({
  label: { full: label, small: label },
  family: "Joke",
  group: "joke",
  description,
  source: "builtin",
  script: "",
  assets: [],
  roles: BROWSER_ROLES,
  reliableEval: false,
  needsWasm: false,
  maxMultiPv: 6,
  playsOwnMoves: true,
  tags: [],
  ...extra,
});

const ENTRIES: Record<EngineName, Entry> = {
  [EngineName.Reckless]: {
    label: { full: "Reckless 0.9.0 (local bridge)", small: "Reckless" },
    family: "Reckless",
    group: "native",
    description:
      "Native engine on this computer, one of the strongest in the world. Can use several threads and lots of memory.",
    source: "bridge",
    script: "reckless",
    assets: [],
    rating: { elo: 3766, source: "ccrl" },
    roles: BROWSER_ROLES,
    reliableEval: true,
    needsWasm: false,
    maxMultiPv: 256,
    tags: ["Native", "Multi-thread"],
    homepage: "https://github.com/codedeliveryservice/Reckless",
    license: "AGPL-3.0",
  },
  [EngineName.Stockfish19]: stockfish({
    label: { full: "Stockfish 19", small: "Stockfish 19" },
    description: "The newest Stockfish with its full neural network.",
    script: "engines/stockfish-19/stockfish-19-single.js",
    assets: ["engines/stockfish-19/stockfish-19-single.wasm"],
    rating: { elo: 3792, source: "ccrl" },
    tags: ["NNUE"],
  }),
  [EngineName.Stockfish19Lite]: stockfish({
    label: { full: "Stockfish 19 Lite", small: "Stockfish 19 Lite" },
    description:
      "Stockfish 19 with a small network: loads in seconds, a little weaker.",
    script: "engines/stockfish-19/stockfish-19-lite-single.js",
    assets: ["engines/stockfish-19/stockfish-19-lite-single.wasm"],
    tags: ["NNUE", "Small"],
  }),
  [EngineName.Stockfish19Asm]: stockfish({
    label: {
      full: "Stockfish 19 Lite (asm.js)",
      small: "Stockfish 19 asm.js",
    },
    description:
      "Stockfish 19 Lite in plain JavaScript. Runs where WebAssembly is blocked, about 15 times slower.",
    script: "engines/stockfish-19/stockfish-19-asm.js",
    needsWasm: false,
    tags: ["No WebAssembly"],
  }),
  [EngineName.Stockfish18]: stockfish({
    label: { full: "Stockfish 18", small: "Stockfish 18" },
    description: "Stockfish 18 with its full neural network.",
    script: "engines/stockfish-18/stockfish-18-single-6563532.js",
    assets: partFiles("engines/stockfish-18/stockfish-18-single-6563532"),
    rating: { elo: 3771, source: "ccrl" },
    tags: ["NNUE"],
  }),
  [EngineName.Stockfish18Lite]: stockfish({
    label: { full: "Stockfish 18 Lite", small: "Stockfish 18 Lite" },
    description: "Stockfish 18 with a small network.",
    script: "engines/stockfish-18/stockfish-18-lite-single.js",
    assets: ["engines/stockfish-18/stockfish-18-lite-single.wasm"],
    tags: ["NNUE", "Small"],
  }),
  [EngineName.Stockfish17_1]: stockfish({
    label: { full: "Stockfish 17.1", small: "Stockfish 17.1" },
    description: "Stockfish 17.1 with its full neural network.",
    script: "engines/stockfish-17.1/stockfish-17.1-single.js",
    assets: partFiles("engines/stockfish-17.1/stockfish-17.1-single"),
    rating: { elo: 3770, source: "ccrl" },
    tags: ["NNUE"],
  }),
  [EngineName.Stockfish17_1Lite]: stockfish({
    label: { full: "Stockfish 17.1 Lite", small: "Stockfish 17.1 Lite" },
    description: "Stockfish 17.1 with a small network.",
    script: "engines/stockfish-17.1/stockfish-17.1-lite-single.js",
    assets: ["engines/stockfish-17.1/stockfish-17.1-lite-single.wasm"],
    tags: ["NNUE", "Small"],
  }),
  [EngineName.Stockfish17]: stockfish({
    label: { full: "Stockfish 17", small: "Stockfish 17" },
    description: "Stockfish 17 with its full neural network.",
    script: "engines/stockfish-17/stockfish-17-single.js",
    assets: partFiles("engines/stockfish-17/stockfish-17-single"),
    rating: { elo: 3775, source: "ccrl" },
    tags: ["NNUE"],
  }),
  [EngineName.Stockfish17Lite]: stockfish({
    label: { full: "Stockfish 17 Lite", small: "Stockfish 17 Lite" },
    description: "Stockfish 17 with a small network.",
    script: "engines/stockfish-17/stockfish-17-lite-single.js",
    assets: ["engines/stockfish-17/stockfish-17-lite-single.wasm"],
    tags: ["NNUE", "Small"],
  }),
  [EngineName.Stockfish16_1]: stockfish({
    label: { full: "Stockfish 16.1", small: "Stockfish 16.1" },
    description: "Stockfish 16.1 with its full neural network.",
    script: "engines/stockfish-16.1/stockfish-16.1-single.js",
    assets: ["engines/stockfish-16.1/stockfish-16.1-single.wasm"],
    rating: { elo: 3762, source: "ccrl" },
    tags: ["NNUE"],
  }),
  [EngineName.Stockfish16_1Lite]: stockfish({
    label: { full: "Stockfish 16.1 Lite", small: "Stockfish 16.1 Lite" },
    description: "Stockfish 16.1 with a small network.",
    script: "engines/stockfish-16.1/stockfish-16.1-lite-single.js",
    assets: ["engines/stockfish-16.1/stockfish-16.1-lite-single.wasm"],
    tags: ["NNUE", "Small"],
  }),
  // Stockfish 16 and Stockfish 16 Lite (HCE) share the script and the WebAssembly file.
  [EngineName.Stockfish16NNUE]: stockfish({
    label: { full: "Stockfish 16", small: "Stockfish 16" },
    description: "Stockfish 16 with its neural network.",
    script: "engines/stockfish-16/stockfish-nnue-16-single.js",
    assets: [
      "engines/stockfish-16/stockfish-nnue-16-single.wasm",
      "engines/stockfish-16/nn-5af11540bbfe.nnue",
    ],
    rating: { elo: 3760, source: "ccrl" },
    init: ["setoption name Use NNUE value true"],
    tags: ["NNUE"],
    maxMultiPv: 500,
  }),
  [EngineName.Stockfish16]: stockfish({
    label: { full: "Stockfish 16 Lite (HCE)", small: "Stockfish 16 Lite" },
    description:
      "Stockfish 16 with its network switched off: the last hand-written evaluation.",
    script: "engines/stockfish-16/stockfish-nnue-16-single.js",
    assets: ["engines/stockfish-16/stockfish-nnue-16-single.wasm"],
    init: ["setoption name Use NNUE value false"],
    tags: ["Hand-written eval", "Small"],
    maxMultiPv: 500,
  }),
  [EngineName.Stockfish11]: stockfish({
    label: { full: "Stockfish 11 (HCE)", small: "Stockfish 11" },
    description:
      "The last Stockfish before neural networks, in plain JavaScript.",
    script: "engines/stockfish-11.js",
    rating: { elo: 3563, source: "ccrl" },
    needsWasm: false,
    // Stockfish 11 only offers "Skill Level", not UCI_Elo.
    nativeElo: undefined,
    maxMultiPv: 500,
    tags: ["Hand-written eval", "No WebAssembly"],
  }),
  [EngineName.LozzaNNUE]: lozza(
    "NNUE",
    3100,
    "A JavaScript engine by Colin Jenkins with a neural network. Strong and tiny."
  ),
  [EngineName.LozzaMini]: lozza(
    "Mini",
    2800,
    "Lozza with a very small network written out as readable boards."
  ),
  [EngineName.LozzaHCE]: lozza(
    "HCE",
    2750,
    "Lozza with a classic hand-written evaluation."
  ),
  [EngineName.LozzaMat]: lozza(
    "Mat",
    2050,
    "Lozza that only counts material: tactically sharp, no positional sense.",
    { tags: ["Pure JavaScript", "Material only"] }
  ),
  [EngineName.LozzaBeal]: lozza(
    "Beal",
    1200,
    "Lozza with random leaf scores. It still searches, so it drifts toward active positions (the Beal effect). Its evaluations are random, so do not trust them.",
    { reliableEval: false, tags: ["Pure JavaScript", "Random eval"] }
  ),
  [EngineName.Tomitank]: {
    label: { full: "tomitankChess 7.0", small: "tomitankChess" },
    family: "tomitankChess",
    group: "other",
    description:
      "A Hungarian JavaScript engine by Tamás Kuzmics. Shows one line only.",
    source: "browser",
    script: "engines/tomitank/tomitankChess.js",
    assets: [],
    rating: { elo: 3045, source: "ccrl" },
    roles: BROWSER_ROLES,
    reliableEval: true,
    needsWasm: false,
    maxMultiPv: 1,
    nodeRunner: "direct",
    tags: ["Pure JavaScript", "One line"],
    homepage: "https://github.com/tomitank/tomitankChess",
    license: "GPL-3.0",
  },
  [EngineName.Drawfish]: joke(
    "Drawfish",
    "Wants a draw, nothing else. Plays whatever keeps the evaluation closest to 0.00: it gives back material when winning and fights hard when losing.",
    { needsAdvisor: true }
  ),
  [EngineName.Worstfish]: joke(
    "Worstfish",
    "Asks a real engine for the worst move and plays it. Every time.",
    { needsAdvisor: true }
  ),
  [EngineName.RandomMover]: joke(
    "Random Mover",
    "Picks any legal move at random."
  ),
  [EngineName.Alphabetical]: joke(
    "Alphabetical",
    "Plays the move that comes first in alphabetical order of its notation."
  ),
  [EngineName.Cccp]: joke(
    "CCCP",
    "Checkmate, Check, Capture, Push: takes the first of those it can, biggest capture first."
  ),
  [EngineName.Pacifist]: joke(
    "Pacifist",
    "Plays good chess but never captures or gives check unless it has no other move.",
    { needsAdvisor: true }
  ),
  [EngineName.Bongcloud]: joke(
    "Bongcloud",
    "Moves its king whenever it legally can, as well as it can. Otherwise plays the best move.",
    { needsAdvisor: true }
  ),
  [EngineName.Swarm]: joke(
    "Swarm",
    "Moves its pieces as close to the enemy king as possible."
  ),
  [EngineName.Huddle]: joke(
    "Huddle",
    "Keeps every piece huddled around its own king."
  ),
  [EngineName.Generous]: joke(
    "Generous",
    "Leaves the most valuable thing it can for the opponent to take."
  ),
};

/** A browser engine file: its size, SHA-256 and the pinned URL users download it from. */
export interface EngineFile {
  bytes: number;
  sha256: string;
  url: string;
}

const FILES: Record<string, EngineFile> = engineFiles.files;
const BUNDLED_FILES = new Set<string>(engineFiles.bundled);

export const getEngineFile = (path: string): EngineFile => {
  const file = FILES[path];
  if (!file) throw new Error(`${path} is not listed in engineFiles.json`);
  return file;
};

/** Whether the app serves this file itself (public/engines), so it is never downloaded. */
export const isBundledFile = (path: string): boolean => BUNDLED_FILES.has(path);

const browserFiles = (entry: Entry): string[] =>
  entry.source === "browser" ? [entry.script, ...entry.assets] : [];

// Rounded like formatModelSize: one decimal below 10 MB, whole numbers above.
const sizeInMb = (paths: string[]): number => {
  const megabytes =
    paths.reduce((total, path) => total + getEngineFile(path).bytes, 0) /
    (1024 * 1024);
  return megabytes < 10
    ? Math.round(megabytes * 10) / 10
    : Math.round(megabytes);
};

export const ENGINE_MODELS = Object.fromEntries(
  Object.entries(ENTRIES).map(([name, entry]) => {
    const paths = browserFiles(entry);
    return [
      name,
      {
        name,
        ...entry,
        sizeMb: sizeInMb(paths),
        bundled: paths.length > 0 && paths.every(isBundledFile),
      },
    ];
  })
) as Record<EngineName, EngineModel>;

export const BUILTIN_ENGINE_NAMES = Object.values(EngineName);

export const isBuiltinEngineName = (value: unknown): value is EngineName =>
  BUILTIN_ENGINE_NAMES.includes(value as EngineName);

export const isNativeEngineId = (value: unknown): value is NativeEngineId =>
  typeof value === "string" &&
  value.startsWith("native:") &&
  value.length > "native:".length;

export const isEngineId = (value: unknown): value is EngineId =>
  isBuiltinEngineName(value) || isNativeEngineId(value);

/** Engines that can run analysis. Joke engines can, but their evaluations are not real. */
export const isAnalysisEngineId = (value: unknown): value is EngineId =>
  isEngineId(value) && getEngineModel(value).roles.analysis;

/** Engines whose evaluations are real, for features that grade moves. */
export const isReliableEngineId = (value: unknown): value is EngineId =>
  isAnalysisEngineId(value) && getEngineModel(value).reliableEval;

/** What the bridge reports about one engine of engines/engines.json. */
export interface NativeEngineInfo {
  id: string;
  name: string;
  elo?: number;
  description?: string;
  // Read from the engine's own "uci" reply by the bridge.
  options?: { name: string; min?: number; max?: number }[];
}

const nativeModels = new Map<NativeEngineId, EngineModel>();

const optionRange = (info: NativeEngineInfo, name: string) =>
  info.options?.find((option) => option.name.toLowerCase() === name);

export const nativeModelFromInfo = (info: NativeEngineInfo): EngineModel => {
  const uciElo = optionRange(info, "uci_elo");
  const multiPv = optionRange(info, "multipv");
  return {
    name: `native:${info.id}`,
    label: { full: `${info.name} (local bridge)`, small: info.name },
    family: info.name,
    group: "native",
    description:
      info.description ?? "A native engine from engines/engines.json.",
    source: "bridge",
    script: info.id,
    assets: [],
    sizeMb: 0,
    bundled: false,
    rating: info.elo ? { elo: info.elo, source: "author" } : undefined,
    roles: BROWSER_ROLES,
    reliableEval: true,
    needsWasm: false,
    nativeElo:
      uciElo?.min !== undefined && uciElo.max !== undefined
        ? { min: uciElo.min, max: uciElo.max }
        : undefined,
    maxMultiPv: multiPv?.max ?? 1,
    tags: ["Native"],
  };
};

/** Replaces the native engines the bridge reported, keeping built-in Reckless separate. */
export const setNativeEngines = (infos: NativeEngineInfo[]): void => {
  nativeModels.clear();
  for (const info of infos) {
    if (info.id === ENGINE_MODELS[EngineName.Reckless].script) continue;
    const model = nativeModelFromInfo(info);
    nativeModels.set(model.name as NativeEngineId, model);
  }
};

const unknownNativeModel = (id: NativeEngineId): EngineModel =>
  nativeModelFromInfo({
    id: id.slice("native:".length),
    name: id.slice("native:".length),
    description: "Not reported by the bridge right now.",
  });

export const getEngineModel = (name: EngineId): EngineModel =>
  isBuiltinEngineName(name)
    ? ENGINE_MODELS[name]
    : (nativeModels.get(name) ?? unknownNativeModel(name));

export const getAllEngineModels = (): EngineModel[] => [
  ...Object.values(ENGINE_MODELS),
  ...nativeModels.values(),
];

export const engineLabel = (name: EngineId): EngineModel["label"] =>
  getEngineModel(name).label;

export const hasNativeEloLimit = (name: EngineId): boolean =>
  !!getEngineModel(name).nativeElo;

/** Highest Elo the strength slider offers: the engine's own rating, when it is known. */
export const DEFAULT_MAX_ELO = 3200;
export const engineMaxElo = (name: EngineId): number =>
  Math.round(getEngineModel(name).rating?.elo ?? DEFAULT_MAX_ELO);

export const getModelFiles = (model: EngineModel): string[] =>
  model.source === "browser" ? [model.script, ...model.assets] : [];

/** The files a user downloads for this engine: all of a browser engine's files except bundled ones. */
export const getDownloadFiles = (model: EngineModel): string[] =>
  getModelFiles(model).filter((file) => !isBundledFile(file));

/** The hosts an engine downloads from, for telling the user where its files come from. */
export const getDownloadHosts = (model: EngineModel): string[] => [
  ...new Set(
    getDownloadFiles(model).map((file) => new URL(getEngineFile(file).url).host)
  ),
];

/** Every file any engine can download, each once. */
export const getAllDownloadFiles = (): string[] => [
  ...new Set(Object.values(ENGINE_MODELS).flatMap(getDownloadFiles)),
];

// Only files that no other model still has stored are removable. Stockfish 16
// and its Lite (HCE) build share files, so removing one must not break the other.
export const getRemovableFiles = (
  name: EngineId,
  stored: ReadonlyMap<string, unknown>
): string[] => {
  const kept = new Set(
    Object.values(ENGINE_MODELS)
      .filter(
        (model) =>
          model.name !== name &&
          getModelFiles(model).some((file) => stored.has(file))
      )
      .flatMap(getModelFiles)
  );

  return getModelFiles(getEngineModel(name)).filter(
    (file) => stored.has(file) && !kept.has(file)
  );
};
