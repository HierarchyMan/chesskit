import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { getCheckedKing } from "@/lib/chess";
import { getBoardDraw, recordedDrawAtEnd } from "@/lib/boardDraw";
import { Color } from "@/types/enums";

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

describe("draw result kings", () => {
  it("leaves incomplete scan previews and malformed input unmarked", () => {
    assert.equal(getBoardDraw("8/8/8/8/8/8/8/8 w - - 0 1"), null);
    assert.equal(getBoardDraw("not a FEN"), null);
  });
  it("marks both kings for stalemate, for either side to move", () => {
    assert.deepEqual(getBoardDraw("7k/5K2/6Q1/8/8/8/8/8 b - - 0 1"), {
      reason: "Stalemate",
      kings: [
        { square: "h8", color: "b" },
        { square: "f7", color: "w" },
      ],
    });
    assert.deepEqual(getBoardDraw("8/8/8/8/8/1q6/2k5/K7 w - - 0 1"), {
      reason: "Stalemate",
      kings: [
        { square: "c2", color: "b" },
        { square: "a1", color: "w" },
      ],
    });
  });

  it("marks both kings for insufficient material, with its own reason", () => {
    const result = getBoardDraw("8/6K1/8/8/8/1k6/8/8 w - - 0 1");
    assert.equal(result?.reason, "Insufficient material");
    assert.deepEqual(result?.kings.map((king) => king.square).sort(), [
      "b3",
      "g7",
    ]);
  });
  it("retains repetition history and handles agreed draws and fifty-move draws", () => {
    const game = new Chess();
    ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"].forEach((move) =>
      game.move(move)
    );
    assert.equal(getBoardDraw(game)?.reason, "Threefold repetition");
    assert.equal(getBoardDraw(new Chess(game.fen())), null);
    assert.equal(
      getBoardDraw(new Chess(), { type: "draw-agreed" })?.kings.length,
      2
    );
    assert.equal(
      getBoardDraw("4k3/8/8/8/8/8/1R6/4K3 w - - 100 51")?.reason,
      "Fifty-move rule"
    );
    assert.equal(
      getBoardDraw(new Chess(), { type: "resign", loser: Color.White }),
      null
    );
  });
  it("does not mark checkmate or a live position as a draw", () => {
    for (const fen of ["7k/6Q1/6K1/8/8/8/8/8 b - - 0 1", new Chess().fen()])
      assert.equal(getBoardDraw(fen), null);
  });
  it("handles drawn timeouts and only marks imported draws at the exact endpoint", () => {
    const timeout = getBoardDraw("4k3/8/8/8/8/8/8/R3K3 w - - 0 1", {
      type: "timeout",
      loser: Color.White,
    });
    assert.equal(timeout?.kings.length, 2);
    assert.match(timeout!.reason, /cannot checkmate/);
    const full = new Chess();
    ["Nf3", "Nf6", "Nc3", "Nc6"].forEach((move) => full.move(move));
    full.setHeader("Result", "1/2-1/2");
    assert.equal(recordedDrawAtEnd(full, full), true);
    assert.equal(
      getBoardDraw(full, null, recordedDrawAtEnd(full, full))?.kings.length,
      2
    );
    const earlier = new Chess(full.fen());
    assert.equal(recordedDrawAtEnd(earlier, full), false);
    const otherPath = new Chess();
    ["Nc3", "Nc6", "Nf3", "Nf6"].forEach((move) => otherPath.move(move));
    assert.equal(otherPath.fen(), full.fen());
    assert.equal(recordedDrawAtEnd(otherPath, full), false);
    const replay = new Chess();
    replay.move("Nf3");
    assert.equal(
      getBoardDraw(replay, null, recordedDrawAtEnd(replay, full)),
      null
    );
    assert.equal(
      getBoardDraw("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1", null, true),
      null
    );
  });
});
