import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickWithVariety } from "@/lib/engine/botChoice";

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
