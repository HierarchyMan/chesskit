import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { DEFAULT_ENGINE } from "@/constants";
import {
  ENGINE_MODELS,
  getDownloadFiles,
  getEngineFile,
  getModelFiles,
  getRemovableFiles,
  isBundledFile,
} from "@/lib/engine/models";
import {
  buildModelView,
  describeModel,
  formatModelSize,
  ModelState,
} from "@/lib/engine/modelStatus";
import { StoredFile, downloadStateOf } from "@/lib/engine/modelStorage";
import engineFiles from "@/lib/engine/engineFiles.json";
import { EngineName } from "@/types/enums";

const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));
const MEBIBYTE = 1024 * 1024;

// A stored copy of each file, exactly as listed (or with another hash, when out of date).
const storedFiles = (
  files: string[],
  sha256 = (file: string) => getEngineFile(file).sha256
): Map<string, StoredFile> =>
  new Map(
    files.map((file) => [
      file,
      { bytes: getEngineFile(file).bytes, sha256: sha256(file) },
    ])
  );

const stateFor = (overrides: Partial<ModelState> = {}): ModelState => ({
  stored: new Map(),
  storageSupported: true,
  running: 0,
  bridge: "unknown",
  supported: true,
  ...overrides,
});

const NNUE = EngineName.Stockfish16NNUE;
const HCE = EngineName.Stockfish16;
const SF18 = EngineName.Stockfish18;
const SF19_LITE = EngineName.Stockfish19Lite;

const walk = (directory: string): string[] =>
  readdirSync(directory).flatMap((item) => {
    const file = join(directory, item);
    return statSync(file).isDirectory() ? walk(file) : [file];
  });

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

  it("lists every browser file with its size, SHA-256 and a pinned HTTPS URL", () => {
    for (const model of Object.values(ENGINE_MODELS)) {
      for (const file of getModelFiles(model)) {
        const entry = getEngineFile(file);
        assert.ok(entry.bytes > 0, file);
        assert.match(entry.sha256, /^[0-9a-f]{64}$/, file);
        assert.match(entry.url, /^https:\/\//, file);
        // A commit or a release version, never a branch or "latest".
        assert.match(entry.url, /\/[0-9a-f]{40}\/|@\d+\.\d+\.\d+\//, file);
      }
    }
  });

  it("takes each model's size from its files", () => {
    for (const model of Object.values(ENGINE_MODELS)) {
      const bytes = getModelFiles(model).reduce(
        (total, file) => total + getEngineFile(file).bytes,
        0
      );
      assert.ok(Math.abs(model.sizeMb - bytes / MEBIBYTE) <= 0.5, model.name);
    }
  });

  it("does not list the same file twice within a model", () => {
    for (const name of Object.values(EngineName)) {
      const files = getModelFiles(ENGINE_MODELS[name]);
      assert.equal(new Set(files).size, files.length, name);
    }
  });
});

describe("bundled engine", () => {
  it("bundles exactly the default engine, Stockfish 19 Lite", () => {
    assert.equal(DEFAULT_ENGINE, SF19_LITE);
    const bundled = Object.values(ENGINE_MODELS).filter(
      (model) => model.bundled
    );
    assert.deepEqual(
      bundled.map((model) => model.name),
      [SF19_LITE]
    );
    assert.deepEqual(getDownloadFiles(ENGINE_MODELS[SF19_LITE]), []);
  });

  it("serves only the bundled files from public/engines", () => {
    const served = walk(join(PUBLIC_DIR, "engines"))
      .map((file) => relative(PUBLIC_DIR, file).split(sep).join("/"))
      .filter((file) => !/(LICENSE|Copying\.txt)$/.test(file))
      .sort();
    assert.deepEqual(served, [...engineFiles.bundled].sort());
    for (const file of engineFiles.bundled) {
      assert.equal(
        statSync(join(PUBLIC_DIR, file)).size,
        getEngineFile(file).bytes,
        file
      );
    }
  });

  it("never treats a non-bundled engine's file as served", () => {
    for (const model of Object.values(ENGINE_MODELS)) {
      if (model.bundled) continue;
      for (const file of getModelFiles(model)) {
        assert.equal(isBundledFile(file), false, `${model.name}: ${file}`);
        assert.equal(existsSync(join(PUBLIC_DIR, file)), false, file);
      }
    }
  });
});

describe("downloadStateOf", () => {
  it("needs no download for the bundled engine", () => {
    assert.equal(
      downloadStateOf(ENGINE_MODELS[SF19_LITE], new Map()),
      "bundled"
    );
  });

  it("counts a model as downloaded only when every file is stored and current", () => {
    const files = getDownloadFiles(ENGINE_MODELS[SF18]);
    assert.equal(
      downloadStateOf(ENGINE_MODELS[SF18], storedFiles(files)),
      "downloaded"
    );
    assert.equal(
      downloadStateOf(ENGINE_MODELS[SF18], storedFiles(files.slice(1))),
      "outdated"
    );
    assert.equal(downloadStateOf(ENGINE_MODELS[SF18], new Map()), "missing");
  });

  it("calls a copy with another hash out of date", () => {
    const files = getDownloadFiles(ENGINE_MODELS[SF18]);
    assert.equal(
      downloadStateOf(
        ENGINE_MODELS[SF18],
        storedFiles(files, () => "0".repeat(64))
      ),
      "outdated"
    );
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
    const stored = storedFiles([
      ...getModelFiles(ENGINE_MODELS[HCE]),
      ENGINE_MODELS[NNUE].assets[1],
    ]);

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
  it("says the bundled engine comes with the app, and when it runs", () => {
    const view = buildModelView(ENGINE_MODELS[SF19_LITE], stateFor());
    assert.equal(view.available, true);
    assert.equal(view.canDownload, false);
    assert.deepEqual(describeModel(view), {
      text: "Comes with the app · 1.8 MB",
      tone: "success",
    });

    const running = buildModelView(
      ENGINE_MODELS[SF19_LITE],
      stateFor({ running: 1 })
    );
    assert.equal(
      describeModel(running).text,
      "Comes with the app · 1.8 MB · In use"
    );
  });

  it("says a browser model is not downloaded, gives its size and cannot run", () => {
    const view = buildModelView(ENGINE_MODELS[SF18], stateFor());

    assert.equal(view.available, false);
    assert.equal(view.canDownload, true);
    assert.deepEqual(describeModel(view), {
      text: "Not downloaded · 108 MB",
      tone: "default",
    });
  });

  it("shows the measured size and that it runs once every file is stored", () => {
    const files = getModelFiles(ENGINE_MODELS[SF18]);
    const stored = storedFiles(files);
    const total = [...stored.values()].reduce(
      (sum, file) => sum + file.bytes,
      0
    );
    const view = buildModelView(
      ENGINE_MODELS[SF18],
      stateFor({ stored, running: 2 })
    );

    assert.equal(view.download, "downloaded");
    assert.equal(view.available, true);
    assert.deepEqual(describeModel(view), {
      text: `Downloaded · ${formatModelSize(total)} · In use`,
      tone: "success",
    });
  });

  it("offers an update for an out-of-date copy", () => {
    const files = getModelFiles(ENGINE_MODELS[SF18]);
    const view = buildModelView(
      ENGINE_MODELS[SF18],
      stateFor({ stored: storedFiles(files, () => "0".repeat(64)) })
    );

    assert.equal(view.available, false);
    assert.equal(view.canDownload, true);
    assert.equal(
      describeModel(view).text,
      "Downloaded copy is out of date · 108 MB to update"
    );
  });

  it("says when this browser cannot keep downloads", () => {
    const view = buildModelView(
      ENGINE_MODELS[SF18],
      stateFor({ storageSupported: false })
    );

    assert.equal(view.canDownload, false);
    assert.equal(describeModel(view).tone, "error");
  });

  it("reports download progress in megabytes", () => {
    const view = buildModelView(
      ENGINE_MODELS[SF18],
      stateFor({
        progress: { receivedBytes: 45 * MEBIBYTE, totalBytes: 108 * MEBIBYTE },
      })
    );

    assert.equal(view.canDownload, false);
    assert.deepEqual(describeModel(view), {
      text: "Downloading 45 MB of 108 MB…",
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
    assert.equal(up.download, undefined);
    assert.equal(up.canDownload, false);
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

    const running = buildModelView(
      reckless,
      stateFor({ bridge: "up", running: 1 })
    );
    assert.equal(describeModel(running).text, "Bridge running · In use");
  });
});
