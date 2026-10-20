// Checks the bundled endgame positions against a real UCI engine.
//
//   node --import ./tests/register.mjs scripts/verify-endgames.mjs
//
// ENGINE_PATH overrides the engine binary, MOVETIME_MS the thinking time.
import { Chess } from "chess.js";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENDGAMES } from "../src/lib/endgames.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const ENGINE =
  process.env.ENGINE_PATH ??
  path.resolve(here, "../../engines/reckless-windows-avx2.exe");
const MOVETIME = Number(process.env.MOVETIME_MS ?? 3000);
const WIN_CP = 300;
const DRAW_CP = 100;

if (!existsSync(ENGINE)) {
  console.error(`Engine not found at ${ENGINE}. Set ENGINE_PATH.`);
  process.exit(2);
}

const engine = spawn(ENGINE, [], { stdio: ["pipe", "pipe", "inherit"] });
engine.stdout.setEncoding("utf8");

let buffer = "";
let listener = null;

engine.stdout.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() ?? "";
  for (const line of lines) listener?.(line);
});

const send = (command) => engine.stdin.write(`${command}\n`);

const collectUntil = (done) =>
  new Promise((resolve) => {
    const lines = [];
    listener = (line) => {
      lines.push(line);
      if (done(line)) {
        listener = null;
        resolve(lines);
      }
    };
  });

send("uci");
await collectUntil((line) => line === "uciok");
send("isready");
await collectUntil((line) => line === "readyok");

let failures = 0;

for (const endgame of ENDGAMES) {
  send("ucinewgame");
  send(`position fen ${endgame.fen}`);
  send(`go movetime ${MOVETIME}`);

  const lines = await collectUntil((line) => line.startsWith("bestmove"));
  const last = lines.filter((line) => /^info .* score /.test(line)).at(-1) ?? "";
  const match = /score (cp|mate) (-?\d+)/.exec(last);

  if (!match) {
    console.log(`FAIL ${endgame.id}: no score from the engine`);
    failures++;
    continue;
  }

  const sideToMove = new Chess(endgame.fen).turn();
  const sign = sideToMove === endgame.player ? 1 : -1;
  const value = Number(match[2]) * sign;
  const isMate = match[1] === "mate";

  const ok =
    endgame.goal === "win"
      ? isMate
        ? value > 0
        : value >= WIN_CP
      : !isMate && Math.abs(value) <= DRAW_CP;

  const shown = isMate ? `mate ${value > 0 ? "+" : ""}${value}` : `${value} cp`;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${endgame.id}: ${endgame.goal} for the player, engine says ${shown}`
  );
  if (!ok) failures++;
}

send("quit");
process.exit(failures ? 1 : 0);
