import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMovesClassification } from "@/lib/engine/helpers/moveClassification";
import { MoveClassification } from "@/types/enums";
import { PositionEval } from "@/types/eval";

const evaluation = (move: string, cp: number): PositionEval => ({
  lines: [{ pv: [move], cp, depth: 12, multiPv: 1 }],
});

describe("forced moves", () => {
  it("grades the only legal move as forced", () => {
    const [, graded] = getMovesClassification(
      [evaluation("g1h1", -900), evaluation("e2e1", -900)],
      ["g1h1"],
      ["7k/8/8/8/8/8/4q3/6K1 w - - 0 1", "7k/8/8/8/8/8/4q3/7K b - - 1 1"]
    );
    assert.equal(graded.moveClassification, MoveClassification.Forced);
  });

  it("does not grade a move forced because the engine reported one line", () => {
    const [, graded] = getMovesClassification(
      [evaluation("d1f3", 35), evaluation("c6d7", 20)],
      ["d4d5"],
      [
        "2kr3r/5ppp/p1q1pn2/1p6/2pPP3/B1P5/5PPP/R2QR1K1 w - - 1 18",
        "2kr3r/5ppp/p1q1pn2/1p1P4/2p1P3/B1P5/5PPP/R2QR1K1 b - - 0 18",
      ]
    );
    assert.notEqual(graded.moveClassification, MoveClassification.Forced);
  });
});
