import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEvaluationResults } from "@/lib/engine/helpers/parseResults";
import { getEvaluationBarValue } from "@/lib/chess";

const WHITE_TO_MOVE =
  "r1b1kbr1/ppp1pppp/2n5/1N4B1/Q7/3n4/PP2PPPP/3RKBNR w - - 0 1";
const BLACK_TO_MOVE = WHITE_TO_MOVE.replace(" w ", " b ");

const info = (score: string) =>
  `info depth 17 multipv 1 score ${score} nodes 1 pv d1d3`;

describe("evaluation perspective", () => {
  it("keeps the engine's score when White is to move", () => {
    const result = parseEvaluationResults([info("cp 777")], WHITE_TO_MOVE);
    assert.equal(result.lines[0].cp, 777);
    assert.ok(getEvaluationBarValue(result).whiteBarPercentage > 90);
  });

  it("turns the side-to-move score into White's score when Black is to move", () => {
    const result = parseEvaluationResults([info("cp 777")], BLACK_TO_MOVE);
    assert.equal(result.lines[0].cp, -777);
    assert.ok(getEvaluationBarValue(result).whiteBarPercentage < 10);
  });

  it("does the same for mate scores", () => {
    const white = parseEvaluationResults([info("mate 3")], WHITE_TO_MOVE);
    const black = parseEvaluationResults([info("mate 3")], BLACK_TO_MOVE);
    assert.equal(white.lines[0].mate, 3);
    assert.equal(black.lines[0].mate, -3);
  });
});
