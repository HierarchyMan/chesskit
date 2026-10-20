import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { getOddsFen } from "@/lib/odds";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("getOddsFen", () => {
  it("keeps the standard position for equal games", () => {
    assert.equal(getOddsFen("none", "b"), START);
  });

  it("removes the right piece from the bot's side", () => {
    assert.match(getOddsFen("queen", "b"), /^rnb1kbnr\/pppppppp/);
    assert.match(getOddsFen("queen", "w"), /PPPPPPPP\/RNB1KBNR/);
    assert.match(getOddsFen("knight", "b"), /^r1bqkbnr/);
    assert.match(getOddsFen("pawn", "b"), /^rnbqkbnr\/ppppp1pp/);
    assert.match(getOddsFen("bishop", "w"), /RNBQK1NR/);
  });

  it("drops the castling right of a removed rook only", () => {
    assert.equal(
      getOddsFen("rook", "b"),
      "1nbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQk - 0 1"
    );
    assert.equal(
      getOddsFen("rook", "w"),
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NBQKBNR w Kkq - 0 1"
    );
  });

  it("always produces a loadable position", () => {
    for (const odds of ["pawn", "knight", "bishop", "rook", "queen"] as const) {
      for (const color of ["w", "b"] as const) {
        assert.doesNotThrow(() => new Chess(getOddsFen(odds, color)));
      }
    }
  });
});
