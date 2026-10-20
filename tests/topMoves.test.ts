import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatLine,
  getFenForSide,
  linesToTopMoves,
} from "@/lib/engine/topMoves";

const IN_CHECK =
  "rnbqkbnr/ppp2ppp/8/1B1pp3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 3";
const CHECKMATE =
  "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("getFenForSide", () => {
  it("returns the position unchanged for the side to move", () => {
    assert.deepEqual(getFenForSide(START, "mover"), { fen: START });
  });

  it("flips the turn and clears en passant for the other side", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2";
    const result = getFenForSide(fen, "opponent");
    assert.ok("fen" in result);
    assert.equal(
      result.fen,
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2"
    );
  });

  it("refuses to pass the move while in check", () => {
    const result = getFenForSide(IN_CHECK, "opponent");
    assert.ok("error" in result);
    assert.match(result.error, /in check/);
  });

  it("still serves the side to move while in check", () => {
    assert.deepEqual(getFenForSide(IN_CHECK, "mover"), { fen: IN_CHECK });
  });

  it("reports finished games and invalid positions", () => {
    const result = getFenForSide(CHECKMATE, "mover");
    assert.ok("error" in result);
    assert.match(result.error, /over/);
    assert.ok("error" in getFenForSide("not a fen", "mover"));
  });
});

describe("linesToTopMoves", () => {
  it("converts engine lines into readable moves", () => {
    const moves = linesToTopMoves(START, [
      { pv: ["e2e4", "e7e5", "g1f3"], cp: 35, depth: 12, multiPv: 1 },
      { pv: ["d2d4", "d7d5"], cp: 28, depth: 12, multiPv: 2 },
    ]);

    assert.equal(moves.length, 2);
    assert.equal(moves[0].san, "e4");
    assert.deepEqual(moves[0].pvSan, ["e4", "e5", "Nf3"]);
    assert.equal(moves[0].evalLabel, "+0.35");
    assert.equal(moves[1].rank, 2);
  });

  it("drops lines that repeat an earlier first move", () => {
    const moves = linesToTopMoves(START, [
      { pv: ["d2d4", "d7d5"], cp: 30, depth: 2, multiPv: 1 },
      { pv: ["d2d4"], cp: 25, depth: 1, multiPv: 2 },
      { pv: ["g1f3"], cp: 20, depth: 2, multiPv: 3 },
    ]);

    assert.deepEqual(
      moves.map((move) => [move.rank, move.uci]),
      [
        [1, "d2d4"],
        [2, "g1f3"],
      ]
    );
  });

  it("stops a line at the first illegal move and skips empty lines", () => {
    const moves = linesToTopMoves(START, [
      { pv: ["e2e4", "e2e4"], cp: 0, depth: 5, multiPv: 1 },
      { pv: [], cp: 0, depth: 5, multiPv: 2 },
    ]);

    assert.equal(moves.length, 1);
    assert.deepEqual(moves[0].pvSan, ["e4"]);
  });

  it("labels mates", () => {
    const [move] = linesToTopMoves("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", [
      { pv: ["a1a8"], mate: 1, depth: 3, multiPv: 1 },
    ]);
    assert.equal(move.san, "Ra8#");
    assert.equal(move.evalLabel, "+M1");
  });
});

describe("formatLine", () => {
  it("numbers a line that starts with White", () => {
    assert.equal(formatLine(START, ["e4", "e5", "Nf3"]), "1. e4 e5 2. Nf3");
  });

  it("marks a line that starts with Black", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    assert.equal(formatLine(fen, ["e5", "Nf3", "Nc6"]), "1... e5 2. Nf3 Nc6");
  });

  it("continues the move numbers of a later position", () => {
    const fen =
      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
    assert.equal(formatLine(fen, ["Bb5", "a6"]), "3. Bb5 a6");
  });
});
