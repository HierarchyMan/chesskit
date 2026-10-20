import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALL_SQUARES,
  isKnightMove,
  isLightSquare,
  isSquare,
  knightDistance,
  knightMoves,
  knightPath,
  randomKnightRoute,
  randomSquare,
} from "@/lib/vision";

describe("squares", () => {
  it("lists all 64 distinct squares", () => {
    assert.equal(ALL_SQUARES.length, 64);
    assert.equal(new Set(ALL_SQUARES).size, 64);
    assert.ok(ALL_SQUARES.every(isSquare));
  });

  it("knows which squares are light", () => {
    assert.equal(isLightSquare("a1"), false);
    assert.equal(isLightSquare("h1"), true);
    assert.equal(isLightSquare("a8"), true);
    assert.equal(isLightSquare("h8"), false);
    assert.equal(isLightSquare("d4"), false);
    assert.equal(isLightSquare("e4"), true);
  });

  it("validates square names", () => {
    assert.equal(isSquare("e4"), true);
    assert.equal(isSquare("i4"), false);
    assert.equal(isSquare("e9"), false);
    assert.equal(isSquare("e"), false);
  });

  it("never repeats the excluded square and stays on the board", () => {
    for (let run = 0; run < 200; run++) {
      const square = randomSquare("e4");
      assert.notEqual(square, "e4");
      assert.ok(isSquare(square));
    }
    assert.ok(isSquare(randomSquare(undefined, () => 1)));
  });
});

describe("knight geometry", () => {
  it("has the right number of moves from corners and the centre", () => {
    assert.equal(knightMoves("a1").length, 2);
    assert.equal(knightMoves("h8").length, 2);
    assert.equal(knightMoves("d4").length, 8);
    assert.equal(knightMoves("a4").length, 4);
  });

  it("only produces moves that really change both coordinates by 1 and 2", () => {
    for (const from of ALL_SQUARES) {
      for (const to of knightMoves(from)) {
        const df = Math.abs(from.charCodeAt(0) - to.charCodeAt(0));
        const dr = Math.abs(Number(from[1]) - Number(to[1]));
        assert.equal(df * dr, 2);
      }
    }
  });

  it("agrees with isKnightMove", () => {
    assert.equal(isKnightMove("b1", "c3"), true);
    assert.equal(isKnightMove("b1", "b3"), false);
  });

  it("finds shortest paths made only of knight moves", () => {
    for (const from of ["a1", "d4", "h8", "b7"]) {
      for (const to of ALL_SQUARES) {
        const path = knightPath(from, to);
        assert.equal(path[0], from);
        assert.equal(path.at(-1), to);
        for (let i = 1; i < path.length; i++) {
          assert.ok(isKnightMove(path[i - 1], path[i]));
        }
      }
    }
  });

  it("reproduces known distances", () => {
    assert.equal(knightDistance("b1", "c3"), 1);
    assert.equal(knightDistance("a1", "b2"), 4);
    assert.equal(knightDistance("a1", "h8"), 6);
    assert.equal(knightDistance("e4", "e4"), 0);
  });

  it("creates routes within the requested length", () => {
    for (let run = 0; run < 50; run++) {
      const { from, to, moves } = randomKnightRoute(2, 4);
      assert.ok(moves >= 2 && moves <= 4);
      assert.equal(knightDistance(from, to), moves);
    }
  });
});
