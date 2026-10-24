import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { createStore } from "jotai/vanilla";
import { getBestMoveHint } from "@/lib/bestMoveHint";
import { positionFor } from "@/lib/currentPosition";
import { projectArenaAnalysis } from "@/lib/engine/arenaAnalysis";
import { effectiveMoveSide, getFenForSide } from "@/lib/engine/topMoves";
import { chessPath, isChessPrefix, navigateChess, replayChess } from "@/lib/chessHistory";
import { loadGameFromText } from "@/lib/pgn";
import {
  analysisReplayStateAtom,
  boardAtom,
  displayedAnalysisGameAtom,
  loadAnalysisGameAtom,
  navigateAnalysisAtom,
} from "@/sections/analysis/sessionAtoms";
import { CurrentPosition } from "@/types/eval";

const line = (pv: string[]) => ({ pv, depth: 12, multiPv: 1, cp: 20 });

describe("engine suggestions never belong to the other side to move", () => {
  it("ignores the previous position's snapshot after the board moves on", () => {
    const game = new Chess();
    game.move("e4");
    const blackToMove = game.fen();
    // The snapshot published for 1.e4 holds Black's candidate moves.
    const stale: CurrentPosition = {
      fen: blackToMove,
      lastMove: game.history({ verbose: true }).at(-1),
      eval: { lines: [line(["e7e5"])] },
      lastEval: { bestMove: "d2d4", lines: [line(["d2d4"])] },
    };
    game.move("c5");
    const whiteToMove = game.fen();
    assert.equal(game.turn(), "w");

    // Until the snapshot for the new board is published, nothing is suggested.
    const shown = positionFor(stale, whiteToMove);
    assert.equal(shown.eval, undefined);
    assert.equal(getBestMoveHint(shown), undefined);
    assert.equal(positionFor(stale, blackToMove), stale);
    assert.equal(positionFor({}, whiteToMove).eval, undefined);
  });

  it("stamps arena projections with the position they describe", () => {
    const game = new Chess();
    game.move("e4");
    game.move("e5");
    const projection = projectArenaAnalysis(game, new Map(), false);
    assert.equal(projection.position.fen, game.fen());
    assert.equal(positionFor(projection.position, game.fen()), projection.position);
  });

  it("drops a top-moves what-if once the position changes", () => {
    const game = new Chess();
    const chosenOn = game.fen();
    const choice = { side: "opponent" as const, fen: chosenOn };
    assert.equal(effectiveMoveSide(choice, chosenOn), "opponent");
    game.move("e4");
    game.move("e5");
    // White to move again: the old "opponent" choice would now query Black.
    const side = effectiveMoveSide(choice, game.fen());
    assert.equal(side, "mover");
    const query = getFenForSide(game.fen(), side);
    assert.ok("fen" in query && query.fen.split(" ")[1] === "w");
    assert.equal(effectiveMoveSide({ side: "mover", fen: null }, chosenOn), "mover");
  });
});

describe("a game's start is the same position for every ply", () => {
  // The header keeps an en-passant square that chess.js normalizes away.
  const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";

  it("uses chess.js's root FEN rather than the raw header", () => {
    const full = new Chess(fen);
    full.move("e5");
    full.move("Nf3");
    const start = replayChess(full, 0);
    assert.equal(chessPath(start).root, chessPath(full).root);
    assert.ok(isChessPrefix(start, full));
    assert.deepEqual(navigateChess(start, full, "next").history(), ["e5"]);
  });

  it("Analysis can step forward again from such a start", () => {
    const store = createStore();
    const source = new Chess(fen);
    source.move("e5");
    source.move("Nf3");
    store.set(loadAnalysisGameAtom, { game: loadGameFromText(source.pgn()) });
    store.set(navigateAnalysisAtom, "end");
    store.set(navigateAnalysisAtom, "start");
    assert.equal(store.get(boardAtom).history().length, 0);
    assert.equal(store.get(boardAtom).turn(), "b");
    assert.equal(store.get(analysisReplayStateAtom).canGoNext, true);
    assert.equal(store.get(displayedAnalysisGameAtom).history().length, 2);
    store.set(navigateAnalysisAtom, "next");
    assert.deepEqual(store.get(boardAtom).history(), ["e5"]);
  });
});
