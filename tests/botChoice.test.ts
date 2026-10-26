import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getBotChoice,
  pickWithVariety,
  searchCandidates,
} from "@/lib/engine/botChoice";
import { UciEngine } from "@/lib/engine/uciEngine";
import { EngineName } from "@/types/enums";
import { PositionEval } from "@/types/eval";

const candidates = [
  { uci: "e2e4", cp: 50 },
  { uci: "d2d4", cp: 40 },
  { uci: "g1f3", cp: 20 },
  { uci: "a2a3", cp: -200 },
];

describe("pickWithVariety", () => {
  it("always takes the best move with no variety", () => {
    for (const roll of [0, 0.5, 0.99]) {
      assert.equal(
        pickWithVariety(candidates, 0, () => roll),
        "e2e4"
      );
    }
  });

  it("chooses among moves within the margin when variety is raised", () => {
    const picks = new Set(
      [0, 0.34, 0.67, 0.99].map((roll) =>
        pickWithVariety(candidates, 0.4, () => roll)
      )
    );

    assert.deepEqual([...picks].sort(), ["d2d4", "e2e4", "g1f3"]);
  });

  it("never picks a move far worse than the best", () => {
    for (const roll of [0, 0.25, 0.5, 0.75, 0.99]) {
      assert.notEqual(
        pickWithVariety(candidates, 1, () => roll),
        "a2a3"
      );
    }
  });

  it("copes with an empty list and clamps variety", () => {
    assert.equal(pickWithVariety([], 0.5), undefined);
    assert.equal(
      pickWithVariety(candidates, -3, () => 0.9),
      "e2e4"
    );
  });
});

// The position of the game where Reckless played 18. d5 for no reason: d4d5 is
// the first legal move, and Reckless's own top lines do not contain it.
const FEN = "2kr3r/5ppp/p1q1pn2/1p6/2pPP3/B1P5/5PPP/R2QR1K1 w - - 1 18";

const fakeEngine = (results: PositionEval[]) => {
  let calls = 0;
  const engine = {
    name: EngineName.Reckless,
    capabilities: { maxMultiPv: 4 },
    evaluatePositionWithUpdate: async () =>
      results[Math.min(calls++, results.length - 1)],
  } as unknown as UciEngine;
  return { engine, calls: () => calls };
};

const line = (move: string, cp: number) => ({
  pv: [move],
  cp,
  depth: 20,
  multiPv: 1,
});
const max = { mode: "max", elo: 3200, depth: 16 } as const;

describe("getBotChoice", () => {
  it("plays the engine's line, never an arbitrary legal move", async () => {
    const { engine } = fakeEngine([
      { lines: [line("d1f3", 35), line("d1e2", 19)], bestMove: "d1f3" },
    ]);
    const choice = await getBotChoice(engine, FEN, max);
    assert.equal(choice?.uci, "d1f3");
  });

  it("falls back to the engine's bestmove when an interrupted search has no lines", async () => {
    const { engine } = fakeEngine([{ lines: [], bestMove: "d1f3" }]);
    const choice = await getBotChoice(engine, FEN, max);
    assert.equal(choice?.uci, "d1f3");
  });

  it("searches again when the search was interrupted and left nothing", async () => {
    const { engine, calls } = fakeEngine([
      { lines: [] },
      { lines: [line("d1f3", 35)], bestMove: "d1f3" },
    ]);
    const choice = await getBotChoice(engine, FEN, max);
    assert.equal(choice?.uci, "d1f3");
    assert.equal(calls(), 2);
  });

  it("reports a failure instead of playing the first legal move", async () => {
    const { engine } = fakeEngine([{ lines: [] }]);
    await assert.rejects(
      () => getBotChoice(engine, FEN, max),
      /no usable move/
    );
  });

  it("ignores a move that is not legal in this position", async () => {
    const { engine } = fakeEngine([
      { lines: [line("e7e5", 10)], bestMove: "e7e5" },
      { lines: [line("d1f3", 35)], bestMove: "d1f3" },
    ]);
    const choice = await getBotChoice(engine, FEN, max);
    assert.equal(choice?.uci, "d1f3");
  });

  it("plays a forced move without searching", async () => {
    const { engine, calls } = fakeEngine([{ lines: [] }]);
    const choice = await getBotChoice(
      engine,
      "7k/8/8/8/8/8/4q3/6K1 w - - 0 1",
      max
    );
    assert.equal(choice?.uci, "g1h1");
    assert.equal(calls(), 0);
  });

  it("never plays a move that only has a bound score", async () => {
    const { engine } = fakeEngine([
      {
        lines: [line("d1f3", 35), { ...line("d4d5", 30), bound: true }],
        bestMove: "d1f3",
      },
    ]);
    for (const roll of [0, 0.5, 0.99]) {
      const choice = await getBotChoice(engine, FEN, max, {
        variety: 1,
        random: () => roll,
      });
      assert.equal(choice?.uci, "d1f3");
    }
  });
});

describe("searchCandidates", () => {
  const at = (move: string, cp: number, depth: number) => ({
    pv: [move],
    cp,
    depth,
    multiPv: 1,
  });
  const legal = ["g7g6", "a7a6", "e7e6", "c8b7"];

  it("drops lines left over from an earlier iteration of a stopped search", () => {
    const candidates = searchCandidates(
      [at("g7g6", 155, 27), at("g7g6", 157, 25), at("e7e6", 165, 27)],
      "w",
      "g7g6",
      legal
    );
    assert.deepEqual(
      candidates.map((candidate) => candidate.uci),
      ["g7g6", "e7e6"]
    );
  });

  it("adds the engine's best move when it has no exact line", () => {
    const candidates = searchCandidates(
      [at("g7g6", 155, 27), at("e7e6", 165, 27)],
      "w",
      "a7a6",
      legal
    );
    assert.deepEqual(candidates.map((candidate) => candidate.uci).sort(), [
      "a7a6",
      "e7e6",
      "g7g6",
    ]);
    assert.equal(candidates.find((c) => c.uci === "a7a6")?.cp, 165);
  });

  it("ignores bounds and a best move that is not legal", () => {
    const candidates = searchCandidates(
      [at("g7g6", 155, 27), { ...at("c8a6", 181, 28), bound: true }],
      "w",
      "h2h4",
      legal
    );
    assert.deepEqual(
      candidates.map((candidate) => candidate.uci),
      ["g7g6"]
    );
  });
});
