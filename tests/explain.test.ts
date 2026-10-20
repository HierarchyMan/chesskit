import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describeMove,
  joinClauses,
  pieceAttacks,
} from "@/lib/visualize/explain";
import { Chess } from "chess.js";

describe("joinClauses", () => {
  it("joins naturally", () => {
    assert.equal(joinClauses(["a"]), "a");
    assert.equal(joinClauses(["a", "b"]), "a and b");
    assert.equal(joinClauses(["a", "b", "c"]), "a, b and c");
  });
});

describe("pieceAttacks", () => {
  it("stops sliding pieces at the first blocker", () => {
    const game = new Chess("4k3/8/8/8/8/8/4P3/R3K3 w - - 0 1");
    const attacked = pieceAttacks(game, "a1");
    assert.ok(attacked.includes("d1"));
    assert.ok(!attacked.includes("f1"));
    assert.ok(attacked.includes("a8"));
  });

  it("knows knight and pawn geometry", () => {
    const game = new Chess("4k3/8/8/3N4/4P3/8/8/4K3 w - - 0 1");
    assert.deepEqual([...pieceAttacks(game, "d5")].sort(), [
      "b4",
      "b6",
      "c3",
      "c7",
      "e3",
      "e7",
      "f4",
      "f6",
    ]);
    assert.deepEqual([...pieceAttacks(game, "e4")].sort(), ["d5", "f5"]);
  });
});

describe("describeMove", () => {
  it("describes a quiet development move", () => {
    const result = describeMove(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "g1f3"
    );
    assert.match(result.text, /^White moves the knight to f3/);
    assert.ok(result.tags.includes("develop"));
  });

  it("notes a free capture", () => {
    const result = describeMove("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", "e4d5");
    assert.match(result.text, /captures the pawn on d5/);
    assert.match(result.text, /winning it for free/);
    assert.equal(result.capturedValue, 1);
  });

  it("warns when a capture loses material", () => {
    const result = describeMove("4k3/8/4p3/3p4/4B3/8/8/4K3 w - - 0 1", "e4d5");
    assert.match(result.text, /can be taken back, which loses material/);
  });

  it("calls an even capture a trade offer", () => {
    const result = describeMove("4k3/4p3/3n4/8/4N3/8/8/4K3 w - - 0 1", "e4d6");
    assert.match(result.text, /offering a trade because it can be recaptured/);
  });

  it("describes castling", () => {
    const result = describeMove("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1");
    assert.match(result.text, /castles kingside/);
    assert.ok(result.tags.includes("castle"));
  });

  it("describes checkmate", () => {
    const result = describeMove("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "a1a8");
    assert.match(result.text, /delivering checkmate/);
    assert.ok(result.tags.includes("mate"));
  });

  it("describes promotion with check", () => {
    const result = describeMove("7k/4P3/8/8/8/8/8/4K3 w - - 0 1", "e7e8q");
    assert.match(result.text, /promotes the pawn on e8 to a queen/);
    assert.match(result.text, /giving check/);
  });

  it("spots a knight fork", () => {
    const result = describeMove("2q3k1/8/8/3N4/8/8/8/4K3 w - - 0 1", "d5e7");
    assert.ok(result.tags.includes("fork"));
    assert.match(result.text, /forking the king on g8 and the queen on c8/);
  });

  it("flags a piece left hanging", () => {
    const result = describeMove("4k3/8/8/3q4/8/8/8/R3K3 w - - 0 1", "a1a5");
    assert.ok(result.tags.includes("hanging"));
    assert.match(result.text, /rook on a5/);
  });

  it("flags a new threat", () => {
    const result = describeMove(
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      "g1f3"
    );
    assert.ok(result.tags.includes("threat"));
    assert.match(result.text, /attacking the pawn on e5/);
  });

  it("does not claim a protected queen can be taken when it mates", () => {
    const result = describeMove(
      "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
      "h5f7"
    );
    assert.equal(
      result.text,
      "White captures the pawn on f7 with the queen, delivering checkmate."
    );
  });

  it("writes a fork as one flowing sentence", () => {
    const result = describeMove(
      "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
      "g8f6"
    );
    assert.equal(
      result.text,
      "Black moves the knight to f6, forking the queen on h5 and the pawn on e4."
    );
  });

  it("ignores a king that cannot actually capture a protected piece", () => {
    const result = describeMove("4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1", "e2e7");
    assert.ok(!/taken back/.test(result.text), result.text);
  });

  it("describes en passant", () => {
    const result = describeMove(
      "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3",
      "e5d6"
    );
    assert.match(result.text, /en passant/);
  });
});
