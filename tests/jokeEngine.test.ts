import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createJokeWorker } from "@/lib/engine/jokes/jokeWorker";
import { UciEngine } from "@/lib/engine/uciEngine";
import { EngineName } from "@/types/enums";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const start = (name: EngineName.RandomMover | EngineName.Alphabetical) =>
  UciEngine.create(name, () =>
    createJokeWorker(name, { advisorDepth: 1, random: () => 0.5 })
  );

describe("a joke engine behind UciEngine", () => {
  it("lists lines for analysis without asking Lichess", async () => {
    const engine = await start(EngineName.Alphabetical);
    const result = await engine.evaluatePositionWithUpdate({
      fen: START,
      depth: 8,
      multiPv: 3,
    });

    assert.equal(result.lines.length, 3);
    assert.equal(result.bestMove, "b1a3");
    assert.ok(result.lines.every((line) => line.pv.length === 1));
    engine.shutdown();
  });

  it("plays a legal move as a bot", async () => {
    const engine = await start(EngineName.RandomMover);
    const move = await engine.getEngineNextMove(START, undefined, 1);

    assert.match(move ?? "", /^[a-h][1-8][a-h][1-8]$/);
    engine.shutdown();
  });

  it("clamps MultiPV to the six lines it offers", async () => {
    const engine = await start(EngineName.RandomMover);
    const result = await engine.evaluatePositionWithUpdate({
      fen: START,
      depth: 1,
      multiPv: 6,
    });

    assert.equal(result.lines.length, 6);
    engine.shutdown();
  });
});
