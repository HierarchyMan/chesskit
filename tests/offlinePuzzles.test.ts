import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { OFFLINE_PUZZLES } from "@/lib/offlinePuzzles";

describe("bundled puzzles", () => {
  it("has a useful number of puzzles with unique ids", () => {
    assert.ok(OFFLINE_PUZZLES.length >= 15);
    assert.equal(
      new Set(OFFLINE_PUZZLES.map((puzzle) => puzzle.id)).size,
      OFFLINE_PUZZLES.length
    );
  });

  for (const puzzle of OFFLINE_PUZZLES) {
    it(`puzzle ${puzzle.id} is playable to the end`, () => {
      const game = new Chess(puzzle.fen);
      assert.ok(puzzle.solution.length >= 1);

      for (const uci of puzzle.solution) {
        const move = game.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.slice(4, 5) || undefined,
        });
        assert.ok(move, `${uci} should be legal`);
      }
    });
  }
});
