import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { OFFLINE_PUZZLES, pickOfflinePuzzle } from "@/lib/offlinePuzzles";
import { PUZZLE_THEMES } from "@/lib/puzzles";

describe("bundled puzzles", () => {
  it("has a useful number of puzzles with unique ids", () => {
    assert.ok(OFFLINE_PUZZLES.length >= 15);
    assert.equal(
      new Set(OFFLINE_PUZZLES.map((puzzle) => puzzle.id)).size,
      OFFLINE_PUZZLES.length
    );
  });

  it("covers every theme offered in the picker", () => {
    for (const { id } of PUZZLE_THEMES) {
      if (id === "mix") continue;
      assert.ok(
        OFFLINE_PUZZLES.some((puzzle) => puzzle.themes.includes(id)),
        `no bundled puzzle for ${id}`
      );
    }
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

describe("pickOfflinePuzzle", () => {
  it("only offers puzzles of the chosen theme", () => {
    for (let run = 0; run < 20; run++) {
      const picked = pickOfflinePuzzle("fork", []);
      assert.equal(picked?.themeMatched, true);
      assert.ok(picked?.puzzle.themes.includes("fork"));
    }
  });

  it("avoids puzzles that were seen recently", () => {
    const forks = OFFLINE_PUZZLES.filter((puzzle) =>
      puzzle.themes.includes("fork")
    );
    const seen = forks.slice(1).map((puzzle) => puzzle.id);

    for (let run = 0; run < 10; run++) {
      assert.equal(pickOfflinePuzzle("fork", seen)?.puzzle.id, forks[0].id);
    }
  });

  it("repeats a puzzle once every one has been seen", () => {
    const seen = OFFLINE_PUZZLES.map((puzzle) => puzzle.id);
    assert.ok(pickOfflinePuzzle("mix", seen));
  });

  it("falls back to any puzzle when the theme has none", () => {
    const picked = pickOfflinePuzzle("no-such-theme", []);
    assert.equal(picked?.themeMatched, false);
    assert.ok(picked?.puzzle);
  });

  it("returns nothing when there are no puzzles at all", () => {
    assert.equal(pickOfflinePuzzle("mix", [], Math.random, []), undefined);
  });

  it("never indexes past the end for a random value of exactly one", () => {
    assert.ok(pickOfflinePuzzle("mix", [], () => 1));
  });
});
