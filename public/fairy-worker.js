// Web Worker adapter for Emscripten UMD chess engines (e.g. Fairy-Stockfish WASM)
// whose main script exports a factory function instead of registering self.onmessage.
const params = new URL(self.location.href).searchParams;
const scriptPath = params.get("script");
const exportName = params.get("export") || "Stockfish";

if (!scriptPath || !scriptPath.startsWith("/engines/")) {
  throw new Error("Invalid engine script path");
}

const scriptUrl = new URL(scriptPath, self.location.origin).href;
const dirUrl = scriptUrl.slice(0, scriptUrl.lastIndexOf("/") + 1);

const pending = [];
let engine = null;

self.onmessage = (event) => {
  const command = event.data;
  if (typeof command !== "string") return;
  if (engine) {
    engine.postMessage(command);
  } else {
    pending.push(command);
  }
};

importScripts(scriptUrl);

const factory = self[exportName];
if (typeof factory !== "function") {
  throw new Error(`Engine script did not define ${exportName}`);
}

factory({
  locateFile: (file) => dirUrl + file,
  mainScriptUrlOrBlob: scriptUrl,
})
  .then((instance) => {
    engine = instance;
    engine.addMessageListener((line) => {
      self.postMessage(line);
    });
    for (const command of pending.splice(0)) {
      engine.postMessage(command);
    }
  })
  .catch((error) => {
    setTimeout(() => {
      throw error instanceof Error ? error : new Error(String(error));
    }, 0);
  });
