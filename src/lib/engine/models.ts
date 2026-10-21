import { EngineName } from "@/types/enums";

export interface EngineModel {
  name: EngineName;
  // "browser" models are static files served with the app and run as WebAssembly.
  // "bridge" models are native programs on this computer, reached through the local bridge.
  source: "browser" | "bridge";
  // File under public/ that the worker starts. Empty for bridge models.
  script: string;
  // Other files under public/ that the script loads: WebAssembly binaries, parts and nets.
  assets: string[];
  // Approximate size in MB, shown before the model is downloaded.
  sizeMb: number;
}

const partFiles = (base: string): string[] =>
  Array.from({ length: 6 }, (_, index) => `${base}-part-${index}.wasm`);

export const ENGINE_MODELS: Record<EngineName, EngineModel> = {
  [EngineName.Reckless]: {
    name: EngineName.Reckless,
    source: "bridge",
    script: "",
    assets: [],
    sizeMb: 0,
  },
  [EngineName.Stockfish18]: {
    name: EngineName.Stockfish18,
    source: "browser",
    script: "engines/stockfish-18/stockfish-18-single-6563532.js",
    assets: partFiles("engines/stockfish-18/stockfish-18-single-6563532"),
    sizeMb: 108,
  },
  [EngineName.Stockfish18Lite]: {
    name: EngineName.Stockfish18Lite,
    source: "browser",
    script: "engines/stockfish-18/stockfish-18-lite-single.js",
    assets: ["engines/stockfish-18/stockfish-18-lite-single.wasm"],
    sizeMb: 7,
  },
  [EngineName.Stockfish17_1]: {
    name: EngineName.Stockfish17_1,
    source: "browser",
    script: "engines/stockfish-17.1/stockfish-17.1-single.js",
    assets: partFiles("engines/stockfish-17.1/stockfish-17.1-single"),
    sizeMb: 75,
  },
  [EngineName.Stockfish17_1Lite]: {
    name: EngineName.Stockfish17_1Lite,
    source: "browser",
    script: "engines/stockfish-17.1/stockfish-17.1-lite-single.js",
    assets: ["engines/stockfish-17.1/stockfish-17.1-lite-single.wasm"],
    sizeMb: 7,
  },
  [EngineName.Stockfish17]: {
    name: EngineName.Stockfish17,
    source: "browser",
    script: "engines/stockfish-17/stockfish-17-single.js",
    assets: partFiles("engines/stockfish-17/stockfish-17-single"),
    sizeMb: 66,
  },
  [EngineName.Stockfish17Lite]: {
    name: EngineName.Stockfish17Lite,
    source: "browser",
    script: "engines/stockfish-17/stockfish-17-lite-single.js",
    assets: ["engines/stockfish-17/stockfish-17-lite-single.wasm"],
    sizeMb: 7,
  },
  [EngineName.Stockfish16_1]: {
    name: EngineName.Stockfish16_1,
    source: "browser",
    script: "engines/stockfish-16.1/stockfish-16.1-single.js",
    assets: ["engines/stockfish-16.1/stockfish-16.1-single.wasm"],
    sizeMb: 66,
  },
  [EngineName.Stockfish16_1Lite]: {
    name: EngineName.Stockfish16_1Lite,
    source: "browser",
    script: "engines/stockfish-16.1/stockfish-16.1-lite-single.js",
    assets: ["engines/stockfish-16.1/stockfish-16.1-lite-single.wasm"],
    sizeMb: 7,
  },
  // Stockfish 16 and Stockfish 16 Lite (HCE) share the script and the WebAssembly file.
  [EngineName.Stockfish16NNUE]: {
    name: EngineName.Stockfish16NNUE,
    source: "browser",
    script: "engines/stockfish-16/stockfish-nnue-16-single.js",
    assets: [
      "engines/stockfish-16/stockfish-nnue-16-single.wasm",
      "engines/stockfish-16/nn-5af11540bbfe.nnue",
    ],
    sizeMb: 39,
  },
  [EngineName.Stockfish16]: {
    name: EngineName.Stockfish16,
    source: "browser",
    script: "engines/stockfish-16/stockfish-nnue-16-single.js",
    assets: ["engines/stockfish-16/stockfish-nnue-16-single.wasm"],
    sizeMb: 1,
  },
  [EngineName.Stockfish11]: {
    name: EngineName.Stockfish11,
    source: "browser",
    script: "engines/stockfish-11.js",
    assets: [],
    sizeMb: 1,
  },
};

export const getEngineModel = (name: EngineName): EngineModel =>
  ENGINE_MODELS[name];

export const getModelFiles = (model: EngineModel): string[] =>
  model.source === "browser" ? [model.script, ...model.assets] : [];

export const getAllModelFiles = (): string[] => [
  ...new Set(Object.values(ENGINE_MODELS).flatMap(getModelFiles)),
];

// Only files that no other model still has stored are removable. Stockfish 16
// and its Lite (HCE) build share files, so removing one must not break the other.
export const getRemovableFiles = (
  name: EngineName,
  stored: ReadonlyMap<string, number>
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

  return getModelFiles(ENGINE_MODELS[name]).filter(
    (file) => stored.has(file) && !kept.has(file)
  );
};
