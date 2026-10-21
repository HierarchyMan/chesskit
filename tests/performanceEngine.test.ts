import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Chess } from "chess.js";
import { EngineName } from "@/types/enums";
import { UciEngine } from "@/lib/engine/uciEngine";
import { EvaluationParser, parseEvaluationResults } from "@/lib/engine/helpers/parseResults";
import { openings } from "@/data/openings";
import { openingForPlacement } from "@/lib/openingIndex";

const instances: FakeWorker[] = [];
let handshake = true;
class FakeWorker {
  onmessage?: (event: { data: string }) => void;
  onerror?: (event: { message: string }) => void;
  commands: string[] = [];
  terminated = false;
  constructor() { instances.push(this); }
  emit(data: string) { this.onmessage?.({ data }); }
  postMessage(command: string) {
    this.commands.push(command);
    if (command === "uci" && handshake) queueMicrotask(() => this.emit("uciok"));
    if (command === "isready") queueMicrotask(() => this.emit("readyok"));
    if (command.startsWith("go ")) queueMicrotask(() => this.emit("info depth 12 multipv 1 score cp 25 pv e2e4 e7e5"));
    if (command === "stop") setTimeout(() => this.emit("bestmove e2e4"), 2);
  }
  terminate() { this.terminated = true; }
}
const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
const tick = () => new Promise((resolve) => setTimeout(resolve, 8));
before(() => { Object.defineProperty(globalThis, "window", { configurable: true, value: { Worker: FakeWorker, location: { hostname: "test" } } }); });
after(() => { Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow }); globalThis.fetch = originalFetch; });

describe("performance engine scheduling", () => {
  it("starts local search before cloud misses, buffers partials, then publishes final", async () => {
    let resolveCloud!: (response: Response) => void;
    globalThis.fetch = () => new Promise((resolve) => { resolveCloud = resolve; });
    const engine = await UciEngine.create(EngineName.Stockfish11, "/fake");
    const updates: unknown[] = [];
    const result = engine.evaluatePositionWithUpdate({ fen: new Chess().fen(), multiPv: 3, setPartialEval: (value) => updates.push(value) });
    await tick();
    const worker = instances.at(-1)!;
    assert.ok(worker.commands.includes("go depth 16"));
    assert.equal(updates.length, 0);
    resolveCloud(new Response(JSON.stringify({ error: "No cloud evaluation available for that position" })));
    await tick();
    worker.emit("bestmove e2e4");
    assert.equal((await result).bestMove, "e2e4");
    assert.ok(updates.length >= 1);
    engine.shutdown();
  });
  it("keeps sufficient cloud preference, drains speculative bestmove and ignores stale publication", async () => {
    const chess = new Chess(); chess.move("d4");
    globalThis.fetch = async () => new Response(JSON.stringify({ depth: 30, pvs: [{ cp: -20, moves: "d7d5 c2c4" }, { cp: -30, moves: "g8f6 c2c4" }] }));
    const engine = await UciEngine.create(EngineName.Stockfish11, "/fake");
    const updates: unknown[] = [];
    const result = await engine.evaluatePositionWithUpdate({ fen: chess.fen(), multiPv: 2, setPartialEval: (value) => updates.push(value) });
    assert.equal(result.lines[0].depth, 30);
    assert.equal(updates.length, 1);
    assert.ok(instances.at(-1)!.commands.includes("stop"));
    const next = engine.evaluatePositionWithUpdate({ fen: new Chess().fen(), useCloudEval: false });
    await tick(); instances.at(-1)!.emit("bestmove g1f3");
    assert.equal((await next).bestMove, "g1f3");
    engine.shutdown();
  });
  it("cancels a pending startup immediately and rejects failed downloads", async () => {
    handshake = false;
    const controller = new AbortController();
    const starting = UciEngine.create(EngineName.Stockfish11, "/fake", undefined, controller.signal);
    controller.abort();
    await assert.rejects(starting, { name: "AbortError" });
    assert.equal(instances.at(-1)!.terminated, true);
    const failed = UciEngine.create(EngineName.Stockfish11, "/missing");
    instances.at(-1)!.onerror?.({ message: "404 engine" });
    await assert.rejects(failed, /404 engine/);
    assert.equal(instances.at(-1)!.terminated, true);
    handshake = true;
  });
  it("cancels stale searches without publishing their final lines", async () => {
    const engine = await UciEngine.create(EngineName.Stockfish11, "/fake");
    const updates: unknown[] = [];
    const first = engine.evaluatePositionWithUpdate({ fen: new Chess().fen(), useCloudEval: false, setPartialEval: (value) => updates.push(value) });
    await tick();
    await engine.stopAllCurrentJobs();
    const count = updates.length;
    assert.deepEqual(await first, { lines: [] });
    instances.at(-1)!.emit("info depth 20 multipv 1 score cp 900 pv e2e4");
    assert.equal(updates.length, count);
    engine.shutdown();
  });
});

describe("indexed and incremental equivalence", () => {
  it("matches the first catalogue entry for every opening, including duplicate placements", () => {
    for (const opening of openings) assert.equal(openingForPlacement(opening.fen), openings.find((candidate) => candidate.fen === opening.fen));
    assert.equal(openingForPlacement("missing"), undefined);
  });
  it("streaming snapshots preserve depth regression, perspective and final bestmove", () => {
    const chess = new Chess(); chess.move("e4");
    const fen = chess.fen();
    const lines = ["info depth 8 multipv 1 score cp 50 pv e7e5 g1f3", "info depth 7 multipv 1 score cp 99 pv c7c5", "info depth 10 multipv 2 score mate -3 pv d7d5 e4d5", "bestmove e7e5"];
    const parser = new EvaluationParser(fen);
    for (let i = 1; i <= lines.length; i++) assert.deepEqual(parser.update(lines.slice(0, i)), parseEvaluationResults(lines.slice(0, i), fen));
    const result = parser.update(lines);
    assert.equal(result.bestMove, "e7e5");
    assert.equal(result.lines.find((line) => line.multiPv === 1)?.cp, -50);
    assert.equal(result.lines.find((line) => line.multiPv === 1)?.depth, 8);
    assert.equal(result.lines.find((line) => line.multiPv === 2)?.mate, 3);
  });
});
