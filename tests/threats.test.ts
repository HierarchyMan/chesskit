import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { findThreats, positionForThreats } from "@/lib/engine/threats";
import { LineEval, PositionEval } from "@/types/eval";

const evaluation = (...lines: Partial<LineEval>[]): PositionEval => ({
  lines: lines.map((line, index) => ({
    pv: [],
    depth: 12,
    multiPv: index + 1,
    ...line,
  })),
});

const OPTIONS = { minimumGain: 15, limit: 2 };

// White to move, with Black's knight able to take a rook on c3 if given the turn.
const WHITE_TO_MOVE = "4k3/pp3ppp/8/3n4/8/2R5/PP3PPP/6K1 w - - 0 1";
const BLACK_TO_MOVE = "4k3/pp3ppp/8/3n4/8/2R5/PP3PPP/6K1 b - - 0 1";

describe("threats", () => {
  it("hands the turn to the opponent and drops the en passant square", () => {
    const fen =
      "rnbqkbnr/ppp1pppp/8/8/3pP3/5N2/PPPP1PPP/RNBQKB1R b KQkq e3 0 3";
    assert.equal(
      positionForThreats(fen),
      "rnbqkbnr/ppp1pppp/8/8/3pP3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3"
    );
  });

  it("has no position to search when the mover is in check or the game is over", () => {
    assert.equal(
      positionForThreats("4k3/8/8/8/8/8/4r3/4K3 w - - 0 1"),
      undefined
    );
    const mate = new Chess();
    for (const move of ["f3", "e5", "g4", "Qh4"]) mate.move(move);
    assert.equal(positionForThreats(mate.fen()), undefined);
  });

  it("keeps a move only when moving first gains the opponent enough", () => {
    // Black's winning chances are 30 now, and 70 if it moves first: a gain of 40.
    const main = evaluation({ cp: 100, pv: ["c3c1"] });
    const passed = evaluation({ cp: -400, pv: ["d5c3"] });
    const [threat, ...rest] = findThreats(WHITE_TO_MOVE, main, passed, OPTIONS);
    assert.equal(threat.uci, "d5c3");
    assert.equal(threat.side, "b");
    assert.ok(threat.gain >= 15);
    assert.deepEqual(rest, []);
  });

  it("ignores a move that only keeps the position as it is", () => {
    const main = evaluation({ cp: 100, pv: ["c3c1"] });
    // White stays ahead even if Black moves first, so nothing is threatened.
    const passed = evaluation({ cp: 60, pv: ["d5b4"] });
    assert.deepEqual(findThreats(WHITE_TO_MOVE, main, passed, OPTIONS), []);
  });

  it("reads the evaluation from the opponent's side, whichever side that is", () => {
    // Scores are always from White's side. With Black to move, White is the
    // opponent: it gains when the passed evaluation rises above the real one.
    const main = evaluation({ cp: -100 });
    const passed = evaluation({ cp: 400, pv: ["c3d3"] });
    const [threat] = findThreats(BLACK_TO_MOVE, main, passed, OPTIONS);
    assert.equal(threat.side, "w");
    assert.equal(threat.uci, "c3d3");
  });

  it("counts a mate as the largest possible gain", () => {
    const main = evaluation({ cp: 0, pv: ["c3c1"] });
    const passed = evaluation({ mate: -1, pv: ["d5c3"] });
    assert.equal(findThreats(WHITE_TO_MOVE, main, passed, OPTIONS).length, 1);
  });

  it("returns the strongest threats first and no more than asked for", () => {
    const main = evaluation({ cp: 100, pv: ["c3c1"] });
    const passed = evaluation(
      { cp: -300, pv: ["d5c3"] },
      { cp: -500, pv: ["d5e3"] },
      { cp: -600, pv: ["d5b4"] }
    );
    const threats = findThreats(WHITE_TO_MOVE, main, passed, {
      minimumGain: 5,
      limit: 2,
    });
    assert.deepEqual(
      threats.map((threat) => threat.uci),
      ["d5b4", "d5e3"]
    );
  });

  it("does not count a quiet move that only keeps the first threat alive", () => {
    const main = evaluation({ cp: 100, pv: ["c3c1"] });
    // Both lines win the rook; the second one just waits and takes it later.
    const passed = evaluation(
      { cp: -400, pv: ["d5c3", "b2c3"] },
      { cp: -400, pv: ["a7a6", "c3c1", "d5c3"] }
    );
    const threats = findThreats(WHITE_TO_MOVE, main, passed, OPTIONS);
    assert.deepEqual(
      threats.map((threat) => threat.uci),
      ["d5c3"]
    );
  });

  it("keeps a second line that threatens something else", () => {
    const main = evaluation({ cp: 100, pv: ["c3c1"] });
    const passed = evaluation(
      { cp: -400, pv: ["d5c3", "b2c3"] },
      { cp: -380, pv: ["d5b4", "c3c1", "b4a2"] }
    );
    const threats = findThreats(WHITE_TO_MOVE, main, passed, OPTIONS);
    assert.deepEqual(
      threats.map((threat) => threat.uci),
      ["d5c3", "d5b4"]
    );
  });

  it("drops a second line that gains far less than the first", () => {
    const main = evaluation({ cp: 0, pv: ["c3c1"] });
    // Taking the rook wins it; waiting a move only gains a little time.
    const passed = evaluation(
      { cp: -650, pv: ["d5c3", "b2c3"] },
      { cp: -155, pv: ["a7a6", "c3d3"] }
    );
    const threats = findThreats(WHITE_TO_MOVE, main, passed, {
      minimumGain: 5,
      limit: 2,
    });
    assert.deepEqual(
      threats.map((threat) => threat.uci),
      ["d5c3"]
    );
  });

  it("drops a move the position does not allow, such as the wrong side's", () => {
    const main = evaluation({ cp: 100 });
    // g8f6 is a move from a square that has no black piece here.
    const passed = evaluation({ cp: -900, pv: ["g8f6"] });
    assert.deepEqual(findThreats(WHITE_TO_MOVE, main, passed, OPTIONS), []);
  });
});
