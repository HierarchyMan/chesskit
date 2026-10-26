// Runs a browser engine that only works inside a Web Worker (Lozza) as a
// command-line UCI engine: stdin lines become worker messages, and the
// worker's messages are printed on stdout.
//
//   node scripts/lib/workerShim.cjs engine-files/engines/lozza/lozzaNNUE.js
const path = require("node:path");
const readline = require("node:readline");
const { Worker } = require("node:worker_threads");

const script = path.resolve(process.argv[2] ?? "");

const workerSource = `
const { parentPort, workerData } = require("node:worker_threads");
const fs = require("node:fs");
globalThis.self = globalThis;
globalThis.postMessage = (message) => parentPort.postMessage(message);
parentPort.on("message", (data) => {
  const handler = globalThis.onmessage;
  if (handler) handler({ data });
});
(0, eval)(fs.readFileSync(workerData.script, "utf8"));
`;

const worker = new Worker(workerSource, { eval: true, workerData: { script } });
worker.on("message", (message) => {
  for (const line of String(message).split(/\r?\n/)) {
    if (line) process.stdout.write(`${line}\n`);
  }
});
worker.on("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});

const input = readline.createInterface({ input: process.stdin });
input.on("line", (line) => {
  if (line.trim() === "quit") {
    void worker.terminate().then(() => process.exit(0));
    return;
  }
  worker.postMessage(line);
});
input.on("close", () => void worker.terminate().then(() => process.exit(0)));
