import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Chess } from "chess.js";
import { getEvaluateGameParams } from "@/lib/chess";
import { UciEngine } from "@/lib/engine/uciEngine";
import { EngineName } from "@/types/enums";
import { PositionEval } from "@/types/eval";

const instances: EarlyReadyWorker[] = [];
class EarlyReadyWorker {
  onmessage?: (event: { data: string }) => void;
  onerror?: (event: { message: string }) => void;
  commands: string[] = [];
  fen = new Chess().fen();
  holdSearch = false;
  holdReady = false;
  waitingReady = false;
  waitingStop = false;
  liveFen?: string;
  terminated = false;

  constructor() {
    instances.push(this);
  }

  emit(data: string) {
    this.onmessage?.({ data });
  }

  postMessage(command: string) {
    this.commands.push(command);
    if (command === "uci") queueMicrotask(() => this.emit("uciok"));
    // UCI permits readyok while a search is still running. It is deliberately
    // immediate, so it cannot accidentally act as a search-completion barrier.
    if (command === "isready") {
      if (this.holdReady) {
        this.holdReady = false;
        this.waitingReady = true;
      } else queueMicrotask(() => this.emit("readyok"));
    }
    if (command.startsWith("position fen ")) this.fen = command.slice(13);
    if (command.startsWith("go ")) {
      if (this.holdSearch) {
        this.holdSearch = false;
        this.liveFen = this.fen;
      } else {
        const fen = this.fen;
        queueMicrotask(() => this.finishSearch(fen));
      }
    }
    if (command === "stop") this.waitingStop = true;
  }

  finishSearch(fen: string, cp = 40) {
    const move = new Chess(fen).moves({ verbose: true })[0];
    const uci = `${move.from}${move.to}${move.promotion ?? ""}`;
    this.emit(`info depth 12 multipv 1 score cp ${cp} pv ${uci}`);
    this.emit(`bestmove ${uci}`);
  }

  drainLiveSearch() {
    assert.ok(this.waitingStop);
    this.waitingStop = false;
    this.finishSearch(this.liveFen!, 900);
  }

  terminate() {
    this.terminated = true;
  }
}

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
before(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { Worker: EarlyReadyWorker, location: { hostname: "test" } },
  });
});
after(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
  globalThis.fetch = originalFetch;
});

const settle = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

describe("full-game search ownership", () => {
  it("drains the live bestmove before configuring or dispatching full-game FENs, even with early readyok and multiple workers", async () => {
    const engine = await UciEngine.create(
      EngineName.Stockfish11,
      "/early-ready"
    );
    const worker = instances.at(-1)!;
    const game = new Chess();
    game.move("e4");
    const updates: PositionEval[] = [];
    let full: ReturnType<UciEngine["evaluateGame"]> | undefined;
    const live = engine.evaluatePositionWithUpdate({
      fen: game.fen(),
      useCloudEval: false,
      setPartialEval: (value) => updates.push(value),
    });
    worker.holdSearch = true;
    try {
      await settle();
      assert.equal(worker.liveFen, game.fen());
      game.move("e5");
      const start = worker.commands.length;
      full = engine.evaluateGame({
        ...getEvaluateGameParams(game),
        multiPv: 2,
        workersNb: 2,
      });
      void full.catch(() => undefined);
      await settle();
      assert.equal(worker.waitingStop, true);
      assert.deepEqual(worker.commands.slice(start), ["stop"]);
      const updateCount = updates.length;
      worker.drainLiveSearch();
      assert.deepEqual(await live, { lines: [] });
      const evaluation = await full;
      assert.deepEqual(
        evaluation.positions.map((position) => position.lines[0].cp),
        [40, -40, 40]
      );
      assert.equal(updates.length, updateCount);
      assert.equal(engine.getIsReady(), true);
      assert.equal(instances.at(-1)!.terminated, true);
      const retry = await engine.evaluatePositionWithUpdate({
        fen: new Chess().fen(),
        useCloudEval: false,
      });
      assert.equal(retry.lines[0].cp, 40);
    } finally {
      engine.shutdown();
      await Promise.allSettled([live, ...(full ? [full] : [])]);
    }
  });

  it("waits for pending live setup before taking ownership and never resurrects that live request", async () => {
    const engine = await UciEngine.create(
      EngineName.Stockfish11,
      "/early-ready"
    );
    const worker = instances.at(-1)!;
    worker.holdReady = true;
    const live = engine.evaluatePositionWithUpdate({
      fen: new Chess().fen(),
      useCloudEval: false,
      multiPv: 2,
    });
    let full: ReturnType<UciEngine["evaluateGame"]> | undefined;
    try {
      await settle();
      assert.equal(worker.waitingReady, true);
      const start = worker.commands.length;
      const game = new Chess();
      game.move("d4");
      full = engine.evaluateGame(getEvaluateGameParams(game));
      void full.catch(() => undefined);
      await settle();
      assert.deepEqual(worker.commands.slice(start), []);
      worker.waitingReady = false;
      worker.emit("readyok");
      assert.deepEqual(await live, { lines: [] });
      assert.deepEqual(
        (await full).positions.map((position) => position.lines[0].cp),
        [40, -40]
      );
      assert.equal(engine.getIsReady(), true);
    } finally {
      engine.shutdown();
      await Promise.allSettled([live, ...(full ? [full] : [])]);
    }
  });

  it("does not publish a delayed cloud result after the full-game search makes the engine ready again", async () => {
    let resolveCloud!: (response: Response) => void;
    globalThis.fetch = () =>
      new Promise((resolve) => {
        resolveCloud = resolve;
      });
    const engine = await UciEngine.create(
      EngineName.Stockfish11,
      "/early-ready"
    );
    const worker = instances.at(-1)!;
    worker.holdSearch = true;
    const previous = new Chess();
    previous.move("c4");
    const updates: PositionEval[] = [];
    const live = engine.evaluatePositionWithUpdate({
      fen: previous.fen(),
      setPartialEval: (value) => updates.push(value),
    });
    let full: ReturnType<UciEngine["evaluateGame"]> | undefined;
    try {
      await settle();
      const game = new Chess();
      game.move("d4");
      game.move("d5");
      full = engine.evaluateGame(getEvaluateGameParams(game));
      void full.catch(() => undefined);
      await settle();
      worker.drainLiveSearch();
      await full;
      assert.equal(engine.getIsReady(), true);
      resolveCloud(
        new Response(
          JSON.stringify({
            depth: 30,
            pvs: [
              { cp: 30, moves: "e7e5 g1f3" },
              { cp: 20, moves: "c7c5 g1f3" },
              { cp: 10, moves: "d7d5 g1f3" },
            ],
          })
        )
      );
      assert.deepEqual(await live, { lines: [] });
      assert.deepEqual(updates, []);
    } finally {
      engine.shutdown();
      resolveCloud(
        new Response(
          JSON.stringify({
            error: "No cloud evaluation available for that position",
          })
        )
      );
      await Promise.allSettled([live, ...(full ? [full] : [])]);
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects a failed stop drain without dispatching FENs or advertising the engine as ready", async () => {
    const engine = await UciEngine.create(
      EngineName.Stockfish11,
      "/early-ready"
    );
    const worker = instances.at(-1)!;
    worker.holdSearch = true;
    const live = engine.evaluatePositionWithUpdate({
      fen: new Chess().fen(),
      useCloudEval: false,
    });
    let full: ReturnType<UciEngine["evaluateGame"]> | undefined;
    try {
      await settle();
      const start = worker.commands.length;
      full = engine.evaluateGame(getEvaluateGameParams(new Chess()));
      void full.catch(() => undefined);
      await settle();
      assert.equal(worker.waitingStop, true);
      worker.onerror?.({ message: "Engine disconnected during stop" });
      await assert.rejects(full, /Engine disconnected during stop/);
      assert.deepEqual(await live, { lines: [] });
      assert.deepEqual(worker.commands.slice(start), ["stop"]);
      assert.equal(engine.getIsReady(), false);
    } finally {
      engine.shutdown();
      await Promise.allSettled([live, ...(full ? [full] : [])]);
    }
  });
});
