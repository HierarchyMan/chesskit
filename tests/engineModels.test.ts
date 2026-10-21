import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ENGINE_MODELS,
  getAllModelFiles,
  getModelFiles,
  getRemovableFiles,
} from "@/lib/engine/models";
import {
  buildModelView,
  describeModel,
  formatModelSize,
  ModelState,
} from "@/lib/engine/modelStatus";
import { EngineName } from "@/types/enums";

const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));
const MEBIBYTE = 1024 * 1024;

const sizeOf = (file: string): number => statSync(join(PUBLIC_DIR, file)).size;

const storedFiles = (files: string[]): Map<string, number> =>
  new Map(files.map((file) => [file, sizeOf(file)]));

const stateFor = (overrides: Partial<ModelState> = {}): ModelState => ({
  stored: new Map(),
  loaded: 0,
  bridge: "unknown",
  supported: true,
  ...overrides,
});

const NNUE = EngineName.Stockfish16NNUE;
const HCE = EngineName.Stockfish16;
const SF18 = EngineName.Stockfish18;

describe("engine model registry", () => {
  it("has exactly one model per engine, under the same name", () => {
    for (const name of Object.values(EngineName)) {
      assert.equal(ENGINE_MODELS[name].name, name);
    }
  });

  it("gives browser models a script and no files for bridge models", () => {
    assert.equal(ENGINE_MODELS[EngineName.Reckless].source, "bridge");
    assert.deepEqual(getModelFiles(ENGINE_MODELS[EngineName.Reckless]), []);

    for (const name of Object.values(EngineName)) {
      const model = ENGINE_MODELS[name];
      if (model.source === "browser") {
        assert.match(model.script, /\.js$/, name);
        assert.ok(getModelFiles(model).length >= 1, name);
      }
    }
  });

  it("lists only files that exist under public/", () => {
    for (const file of getAllModelFiles()) {
      assert.ok(existsSync(join(PUBLIC_DIR, file)), `missing ${file}`);
    }
  });

  it("does not list the same file twice within a model", () => {
    for (const name of Object.values(EngineName)) {
      const files = getModelFiles(ENGINE_MODELS[name]);
      assert.equal(new Set(files).size, files.length, name);
    }
  });

  it("declares sizes within 1 MB of the real files", () => {
    for (const name of Object.values(EngineName)) {
      const model = ENGINE_MODELS[name];
      if (model.source !== "browser") continue;

      const totalBytes = getModelFiles(model).reduce(
        (total, file) => total + sizeOf(file),
        0
      );
      const difference = Math.abs(model.sizeMb - totalBytes / MEBIBYTE);
      assert.ok(difference <= 1, `${name}: ${model.sizeMb} vs ${totalBytes}`);
    }
  });
});

describe("getRemovableFiles", () => {
  it("removes every file of a model that no other stored model uses", () => {
    const stored = storedFiles(getModelFiles(ENGINE_MODELS[SF18]));

    assert.deepEqual(
      getRemovableFiles(SF18, stored),
      getModelFiles(ENGINE_MODELS[SF18])
    );
  });

  it("keeps the shared script and wasm while the Lite (HCE) build is stored", () => {
    const stored = storedFiles(getModelFiles(ENGINE_MODELS[HCE]));
    stored.set(
      ENGINE_MODELS[NNUE].assets[1],
      sizeOf(ENGINE_MODELS[NNUE].assets[1])
    );

    assert.deepEqual(getRemovableFiles(NNUE, stored), [
      ENGINE_MODELS[NNUE].assets[1],
    ]);
  });

  it("removes nothing that is not stored", () => {
    assert.deepEqual(getRemovableFiles(SF18, new Map()), []);
  });
});

describe("formatModelSize", () => {
  it("uses one decimal below 10 MB and whole numbers above", () => {
    assert.equal(formatModelSize(0), "0.0 MB");
    assert.equal(formatModelSize(7.3 * MEBIBYTE), "7.3 MB");
    assert.equal(formatModelSize(108 * MEBIBYTE), "108 MB");
  });
});

describe("describeModel", () => {
  it("says a browser model is not downloaded and gives its approximate size", () => {
    const view = buildModelView(ENGINE_MODELS[SF18], stateFor());

    assert.deepEqual(describeModel(view), {
      text: "Not downloaded · about 108 MB",
      tone: "default",
    });
  });

  it("shows the measured size and that it is loaded once every file is stored", () => {
    const files = getModelFiles(ENGINE_MODELS[SF18]);
    const stored = storedFiles(files);
    const total = [...stored.values()].reduce((sum, bytes) => sum + bytes, 0);
    const view = buildModelView(
      ENGINE_MODELS[SF18],
      stateFor({ stored, loaded: 2 })
    );

    assert.equal(view.downloaded, true);
    assert.deepEqual(describeModel(view), {
      text: `Downloaded · ${formatModelSize(total)} · Loaded`,
      tone: "success",
    });
  });

  it("counts a model as downloaded only when all of its files are stored", () => {
    const [script] = getModelFiles(ENGINE_MODELS[SF18]);
    const view = buildModelView(
      ENGINE_MODELS[SF18],
      stateFor({ stored: new Map([[script, sizeOf(script)]]) })
    );

    assert.equal(view.downloaded, false);
  });

  it("reports download progress by file", () => {
    const view = buildModelView(
      ENGINE_MODELS[SF18],
      stateFor({ progress: { done: 2, total: 6 } })
    );

    assert.deepEqual(describeModel(view), {
      text: "Downloading 2 of 6 files…",
      tone: "default",
    });
  });

  it("shows the reason when a download failed", () => {
    const view = buildModelView(
      ENGINE_MODELS[SF18],
      stateFor({ error: "HTTP 503" })
    );

    assert.deepEqual(describeModel(view), {
      text: "Download failed: HTTP 503",
      tone: "error",
    });
  });

  it("explains when a browser cannot run the engine at all", () => {
    const view = buildModelView(
      ENGINE_MODELS[SF18],
      stateFor({ supported: false })
    );

    assert.equal(view.available, false);
    assert.equal(describeModel(view).tone, "error");
  });

  it("reports the Reckless bridge and never offers a download for it", () => {
    const reckless = ENGINE_MODELS[EngineName.Reckless];

    const up = buildModelView(reckless, stateFor({ bridge: "up" }));
    assert.equal(up.downloaded, false);
    assert.equal(up.available, true);
    assert.deepEqual(describeModel(up), {
      text: "Bridge running",
      tone: "success",
    });

    const down = buildModelView(reckless, stateFor({ bridge: "down" }));
    assert.equal(down.available, false);
    assert.deepEqual(describeModel(down), {
      text: "Bridge not running",
      tone: "error",
    });

    const loaded = buildModelView(
      reckless,
      stateFor({ bridge: "up", loaded: 1 })
    );
    assert.equal(describeModel(loaded).text, "Bridge running · Loaded");
  });
});
