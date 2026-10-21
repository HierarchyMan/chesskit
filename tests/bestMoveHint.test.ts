import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Move } from "chess.js";
import { getBestMoveHint } from "@/lib/bestMoveHint";
import { MoveClassification } from "@/types/enums";
import { CurrentPosition } from "@/types/eval";

const played = { lan: "f2f3", before: "fen" } as Move;

const position = (
  overrides: Partial<CurrentPosition> & { bestMove?: string } = {}
): CurrentPosition => {
  const { bestMove = "e2e4", ...rest } = overrides;
  return {
    lastMove: played,
    lastEval: { bestMove, lines: [] },
    ...rest,
  };
};

describe("best-move hint", () => {
  it("offers the engine's alternative when the played move differs", () => {
    assert.equal(getBestMoveHint(position()), "e2e4");
  });

  it("offers an alternative before the played move has been graded", () => {
    assert.equal(getBestMoveHint(position({ eval: { lines: [] } })), "e2e4");
  });

  it("is hidden when the played move was the engine's choice", () => {
    assert.equal(getBestMoveHint(position({ bestMove: "f2f3" })), undefined);
  });

  it("is hidden for moves graded as best, book, forced or perfect", () => {
    for (const moveClassification of [
      MoveClassification.Best,
      MoveClassification.Opening,
      MoveClassification.Forced,
      MoveClassification.Perfect,
    ]) {
      assert.equal(
        getBestMoveHint(position({ eval: { lines: [], moveClassification } })),
        undefined,
        moveClassification
      );
    }
  });

  it("stays visible for other grades, including splendid moves", () => {
    for (const moveClassification of [
      MoveClassification.Splendid,
      MoveClassification.Excellent,
      MoveClassification.Blunder,
    ]) {
      assert.equal(
        getBestMoveHint(position({ eval: { lines: [], moveClassification } })),
        "e2e4",
        moveClassification
      );
    }
  });

  it("needs both a played move and an evaluated previous position", () => {
    assert.equal(getBestMoveHint({}), undefined);
    assert.equal(getBestMoveHint({ lastMove: played }), undefined);
    assert.equal(
      getBestMoveHint({ lastEval: { lines: [], bestMove: "e2e4" } }),
      undefined
    );
  });
});
