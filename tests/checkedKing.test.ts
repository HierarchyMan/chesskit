import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { getCheckedKing } from "@/lib/chess";

describe("checked king", () => {
  it("is null when the side to move is not in check", () => {
    assert.equal(getCheckedKing(new Chess()), null);
  });

  it("marks the king in check without marking mate", () => {
    const game = new Chess("4k3/8/8/8/8/8/4R3/4K3 b - - 0 1");
    assert.deepEqual(getCheckedKing(game), { square: "e8", mated: false });
  });

  it("marks the mated king as checkmate", () => {
    const game = new Chess(
      "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3"
    );
    assert.deepEqual(getCheckedKing(game), { square: "e1", mated: true });
  });
});
