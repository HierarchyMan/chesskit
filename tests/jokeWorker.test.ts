import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { createJokeWorker } from "@/lib/engine/jokes/jokeWorker";
import { UciEngine } from "@/lib/engine/uciEngine";
import { EngineName } from "@/types/enums";
import { EngineWorker } from "@/types/engine";
import { LineEval } from "@/types/eval";

// "position fen …" after each move of the position, scored for white.
const FEN = "4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1";
const WHITE_SCORES: Record<string, number> = {
  e4d5: 900,
  e4e5: -850,
  e1e2: -810,
  e1f1: -790,
  e1f2: -30,
};

// An advisor that lists every move at once, like Stockfish with MultiPV.
const stubAdvisor = (): UciEngine =>
  ({
    capabilities: { maxMultiPv: 256 },
    evaluatePositionWithUpdate: async () => ({
      lines: Object.entries(WHITE_SCORES).map(
        ([uci, cp], index): LineEval => ({
          pv: [uci],
          cp,
          depth: 6,
          multiPv: index + 1,
        })
      ),
    }),
    stopAllCurrentJobs: async () => undefined,
    shutdown: () => undefined,
  }) as unknown as UciEngine;

const run = (worker: EngineWorker, commands: string[], until: string) =>
  new Promise<string[]>((resolve) => {
    const lines: string[] = [];
    worker.listen = (line) => {
      lines.push(line);
      if (line.startsWith(until)) resolve(lines);
    };
    for (const command of commands) worker.uci(command);
  });

describe("joke worker", () => {
  it("answers the UCI handshake with a MultiPV option", async () => {
    const worker = createJokeWorker(EngineName.RandomMover, {
      advisorDepth: 1,
    });
    const lines = await run(worker, ["uci"], "uciok");
    assert.ok(lines.some((line) => line.startsWith("option name MultiPV")));
  });

  it("plays Drawfish's move from the advisor's scores", async () => {
    const worker = createJokeWorker(EngineName.Drawfish, {
      advisorDepth: 6,
      startAdvisor: async () => stubAdvisor(),
    });
    const lines = await run(
      worker,
      ["setoption name MultiPV value 3", `position fen ${FEN}`, "go depth 14"],
      "bestmove"
    );
    assert.equal(lines.at(-1), "bestmove e1f2");
    // Lines report the depth asked for: the app shows lines under depth 6 as unfinished.
    for (const line of lines.filter((entry) => entry.includes(" multipv "))) {
      assert.match(line, /^info depth 14 /);
    }
    assert.equal(lines.filter((line) => line.includes(" multipv ")).length, 3);
    assert.match(lines[0], /score cp -30 pv e1f2$/);
  });

  it("follows the moves after a position", async () => {
    const worker = createJokeWorker(EngineName.Alphabetical, {
      advisorDepth: 1,
    });
    const lines = await run(
      worker,
      ["position startpos moves e2e4", "go depth 1"],
      "bestmove"
    );
    // Black to move: Na6 sorts first.
    assert.equal(lines.at(-1), "bestmove b8a6");
  });

  it("answers stop with a legal move right away", async () => {
    const worker = createJokeWorker(EngineName.Worstfish, {
      advisorDepth: 6,
      startAdvisor: () => new Promise(() => undefined),
    });
    const lines = await run(
      worker,
      [`position fen ${FEN}`, "go depth 1", "stop"],
      "bestmove"
    );
    const move = lines.at(-1)!.split(" ")[1];
    const legal = new Chess(FEN)
      .moves({ verbose: true })
      .map((entry) => entry.from + entry.to);
    assert.ok(legal.includes(move), move);
    assert.equal(worker.searching, false);
  });

  it("reports no move when the game is over", async () => {
    const worker = createJokeWorker(EngineName.Cccp, { advisorDepth: 1 });
    const lines = await run(
      worker,
      ["position fen 7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", "go depth 1"],
      "bestmove"
    );
    assert.equal(lines.at(-1), "bestmove (none)");
  });

  it("answers a stopped search once, so the next search is not cut short", async () => {
    const worker = createJokeWorker(EngineName.Cccp, { advisorDepth: 1 });
    const lines: string[] = [];
    worker.listen = (line) => lines.push(line);

    worker.uci(`position fen ${FEN}`);
    worker.uci("go depth 1");
    worker.uci("stop");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(lines.filter((line) => line.startsWith("bestmove")).length, 1);

    // The next search gets its own lines and its own bestmove.
    lines.length = 0;
    worker.uci("go depth 1");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(lines.some((line) => line.includes(" multipv 1 ")));
    assert.equal(lines.filter((line) => line.startsWith("bestmove")).length, 1);
    assert.equal(worker.searching, false);
  });
});
