import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import {
  chessPathKey,
  isChessPrefix,
  navigateChess,
  replayChess,
  replayState,
} from "@/lib/chessHistory";
import { getEvaluateGameParams } from "@/lib/chess";
import { projectArenaAnalysis } from "@/lib/engine/arenaAnalysis";
import { terminalEvaluation } from "@/lib/engine/terminalEvaluation";

const game = (...moves: string[]) => {
  const board = new Chess();
  for (const move of moves) board.move(move);
  return board;
};

describe("exact chess history identity", () => {
  it("refuses forward replay between different roots with identical SAN", () => {
    const original = game("e4", "e5");
    const different = new Chess(new Chess().fen().replace("0 1", "7 42"));
    different.move("e4");
    assert.equal(different.history().join(), "e4");
    assert.equal(isChessPrefix(different, original), false);
    assert.equal(replayState(different, original).canGoNext, false);
    assert.equal(navigateChess(different, original, "next"), different);
    different.move("e5");
    assert.equal(replayState(different, original).atEnd, false);
    assert.equal(
      navigateChess(different, original, "end").fen(),
      original.fen()
    );
  });

  it("distinguishes transposed paths sharing the same final FEN and last move in Arena", () => {
    const first = game("Nf3", "Nf6", "Nc3", "Nc6", "e4");
    const second = game("Nc3", "Nc6", "Nf3", "Nf6", "e4");
    assert.equal(first.fen(), second.fen());
    assert.notEqual(chessPathKey(first), chessPathKey(second));
    assert.notEqual(
      projectArenaAnalysis(first, new Map(), true).moves.at(-1)!.key,
      projectArenaAnalysis(second, new Map(), true).moves.at(-1)!.key
    );
  });

  it("preserves Black roots, counters, underpromotion, metadata and comments in replay", () => {
    const original = new Chess("7k/P7/8/8/8/8/8/7K b - - 13 42");
    original.setHeader("Custom", "history fixture");
    original.move("Kh7");
    original.setComment("before promotion");
    original.move({ from: "a7", to: "a8", promotion: "n" });
    const prefix = replayChess(original, 1);
    const next = navigateChess(prefix, original, "next");
    assert.equal(next.fen(), original.fen());
    assert.equal(next.getHeaders().Custom, "history fixture");
    assert.equal(replayChess(next, 1).getComment(), "before promotion");
    assert.equal(replayChess(next, 0).fen(), "7k/P7/8/8/8/8/8/7K b - - 13 42");
    for (const invalid of [-1, 0.5, NaN, Infinity, 3])
      assert.throws(() => replayChess(original, invalid));
  });

  it("returns a useful single-position evaluation request for zero-move roots", () => {
    const root = new Chess("4k3/8/8/8/8/8/1R6/4K3 b - - 0 42");
    assert.deepEqual(getEvaluateGameParams(root), {
      fens: [root.fen()],
      uciMoves: [],
    });
  });

  it("uses the same terminal scores in both modes, including history-dependent draws", () => {
    const mate = game("f3", "e5", "g4", "Qh4#");
    assert.equal(terminalEvaluation(mate)!.lines[0].mate, -1);
    assert.equal(
      terminalEvaluation(new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"))!.lines[0]
        .cp,
      0
    );
    const repeated = game(
      "Nf3",
      "Nf6",
      "Ng1",
      "Ng8",
      "Nf3",
      "Nf6",
      "Ng1",
      "Ng8"
    );
    assert.equal(terminalEvaluation(repeated)!.lines[0].cp, 0);
    assert.equal(
      getEvaluateGameParams(repeated).terminalPositions![8].lines[0].cp,
      0
    );
    assert.equal(terminalEvaluation(new Chess(repeated.fen())), undefined);
    assert.equal(
      projectArenaAnalysis(repeated, new Map(), true).position.eval!.lines[0]
        .cp,
      0
    );
  });
});
