import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { getPreviousBestMoveHint } from "@/lib/bestMoveHint";
import { MoveClassification } from "@/types/enums";
import { CurrentPosition } from "@/types/eval";

const played = new Chess().move("f3");

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

describe("previous-move alternative", () => {
  it("offers the engine's alternative when the played move differs", () => {
    assert.equal(getPreviousBestMoveHint(position()), "e2e4");
  });

  it("offers an alternative before the played move has been graded", () => {
    assert.equal(
      getPreviousBestMoveHint(position({ eval: { lines: [] } })),
      "e2e4"
    );
  });

  it("is hidden when the played move was the engine's choice", () => {
    assert.equal(
      getPreviousBestMoveHint(position({ bestMove: "f2f3" })),
      undefined
    );
  });

  it("is hidden for moves graded as best, book, forced or perfect", () => {
    for (const moveClassification of [
      MoveClassification.Best,
      MoveClassification.Opening,
      MoveClassification.Forced,
      MoveClassification.Perfect,
    ]) {
      assert.equal(
        getPreviousBestMoveHint(
          position({ eval: { lines: [], moveClassification } })
        ),
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
        getPreviousBestMoveHint(
          position({ eval: { lines: [], moveClassification } })
        ),
        "e2e4",
        moveClassification
      );
    }
  });

  it("needs both a played move and an evaluated previous position", () => {
    assert.equal(getPreviousBestMoveHint({}), undefined);
    assert.equal(getPreviousBestMoveHint({ lastMove: played }), undefined);
    assert.equal(
      getPreviousBestMoveHint({ lastEval: { lines: [], bestMove: "e2e4" } }),
      undefined
    );
  });
});
