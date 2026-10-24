// The app's engines as child processes, for the scripts that check the app
// against real engines. Which engine the app uses is the user's choice, so
// nothing is measured on one engine alone: by default a script runs on every
// engine of the app's own registry (src/lib/engine/models.ts) that can run here.
//
//   ENGINE=stockfish_17_lite,reckless   a comma list of engine names, or "all"
//   ENGINE_PATH=...                     the binary, when a single engine is named
//
// Browser engines are the WebAssembly builds served with the app, run under
// Node. Reckless is the native program next to the app.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_MODELS } from "../../src/lib/engine/models.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const STARTUP_MS = 30000;

const locate = (name) => {
  const model = ENGINE_MODELS[name];
  if (name === "reckless") {
    return {
      command:
        process.env.ENGINE_PATH ??
        path.resolve(root, "../engines/reckless-windows-avx2.exe"),
      args: [],
    };
  }

  const script =
    process.env.ENGINE_PATH ?? path.resolve(root, "public", model.script);
  return { command: process.execPath, args: [script] };
};

/** The engines the user asked for with ENGINE, or every engine of the app. */
export const requestedEngines = () => {
  const spec = process.env.ENGINE ?? "all";
  if (spec === "all") return Object.keys(ENGINE_MODELS);

  const names = spec.split(",").map((entry) => entry.trim());
  const unknown = names.filter((name) => !(name in ENGINE_MODELS));
  if (unknown.length) {
    console.error(
      `Unknown engine ${unknown.join(", ")}. Choose from: ${Object.keys(ENGINE_MODELS).join(", ")}`
    );
    process.exit(2);
  }
  return names;
};

/** An engine ready for UCI, or undefined (with the reason printed) if it cannot run here. */
export const startEngine = async (name) => {
  const { command, args } = locate(name);
  const file = args[0] ?? command;
  if (!existsSync(file)) {
    console.log(`${name}: skipped, nothing at ${file}`);
    return undefined;
  }

  const engine = spawn(command, args, { stdio: ["pipe", "pipe", "inherit"] });
  engine.on("error", () => undefined);
  engine.stdout.setEncoding("utf8");

  let buffer = "";
  let listener = null;
  engine.stdout.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) listener?.(line);
  });

  const send = (text) => engine.stdin.write(`${text}\n`);

  const collectUntil = (done, timeoutMs) =>
    new Promise((resolve, reject) => {
      const lines = [];
      const timer = timeoutMs
        ? setTimeout(() => reject(new Error("timed out")), timeoutMs)
        : undefined;
      listener = (line) => {
        lines.push(line);
        if (done(line)) {
          clearTimeout(timer);
          listener = null;
          resolve(lines);
        }
      };
    });

  const close = () => {
    try {
      send("quit");
      engine.stdin.end();
    } catch {
      /* The process is already gone. */
    }
    engine.kill();
  };

  try {
    send("uci");
    await collectUntil((line) => line === "uciok", STARTUP_MS);
    send("isready");
    await collectUntil((line) => line === "readyok", STARTUP_MS);
  } catch (error) {
    console.log(
      `${name}: skipped, it did not start under Node (${error.message})`
    );
    close();
    return undefined;
  }

  /** Every line the engine printed while searching, up to its "bestmove". */
  const search = async (fen, depth, multiPv = 1) => {
    send(`setoption name MultiPV value ${multiPv}`);
    send("isready");
    await collectUntil((line) => line === "readyok");
    send(`position fen ${fen}`);
    send(`go depth ${depth}`);
    return collectUntil((line) => line.startsWith("bestmove"));
  };

  return {
    name,
    search,
    newGame: () => send("ucinewgame"),
    close,
  };
};
