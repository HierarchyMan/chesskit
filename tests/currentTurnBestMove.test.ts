import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess, Square } from "chess.js";
import { createStore } from "jotai/vanilla";
import {
  getBestMoveHint,
  getBestMoveSuggestion,
  getMoveFeedback,
  getPreviousBestMoveFeedback,
} from "@/lib/bestMoveHint";
import { positionFor } from "@/lib/currentPosition";
import { projectArenaAnalysis } from "@/lib/engine/arenaAnalysis";
import { chessPathKey } from "@/lib/chessHistory";
import { PositionArrows } from "@/lib/engine/topMoves";
import {
  arenaGameAtom,
  arenaProposalArrowsAtom,
} from "@/sections/arena/states";
import { MoveClassification } from "@/types/enums";
import { CurrentPosition, PositionEval } from "@/types/eval";

const evaluation = (bestMove: string): PositionEval => ({
  bestMove,
  lines: [{ pv: [bestMove], depth: 12, multiPv: 1, cp: 0 }],
});

describe("Arena proposal arrows belong to their exact game path", () => {
  it("hides old-turn arrows before effects and rejects delayed old publications and cleanup", () => {
    const store = createStore();
    const black = new Chess();
    black.move("e4");
    store.set(arenaGameAtom, black);
    const old: PositionArrows = {
      positionKey: chessPathKey(black),
      arrows: [{ from: "e7", to: "e5", kind: "best", side: "b" }],
    };
    store.set(arenaProposalArrowsAtom, old);
    assert.deepEqual(store.get(arenaProposalArrowsAtom), old.arrows);
    const white = new Chess();
    white.move("e4");
    white.move("c5");
    store.set(arenaGameAtom, white);
    assert.deepEqual(store.get(arenaProposalArrowsAtom), []);
    const current: PositionArrows = {
      positionKey: chessPathKey(white),
      arrows: [{ from: "g1", to: "f3", kind: "best", side: "w" }],
    };
    store.set(arenaProposalArrowsAtom, current);
    store.set(arenaProposalArrowsAtom, old);
    assert.deepEqual(store.get(arenaProposalArrowsAtom), current.arrows);
    store.set(arenaProposalArrowsAtom, { ...old, arrows: [] });
    assert.deepEqual(store.get(arenaProposalArrowsAtom), current.arrows);
  });

  it("does not reuse a hover from another path that transposes to the same FEN", () => {
    const store = createStore();
    const first = new Chess();
    for (const move of ["Nf3", "Nf6", "Nc3", "Nc6"]) first.move(move);
    const second = new Chess();
    for (const move of ["Nc3", "Nc6", "Nf3", "Nf6"]) second.move(move);
    assert.equal(first.fen(), second.fen());
    store.set(arenaGameAtom, first);
    store.set(arenaProposalArrowsAtom, {
      positionKey: chessPathKey(first),
      arrows: [{ from: "e2", to: "e4", kind: "best", side: "w" }],
    });
    store.set(arenaGameAtom, second);
    assert.deepEqual(store.get(arenaProposalArrowsAtom), []);
  });
});

describe("best-move arrows describe the current turn", () => {
  it("offers White's legal continuation while retaining clearly contextual Black feedback", () => {
    const game = new Chess();
    game.move("e4");
    const blackFen = game.fen();
    const lastMove = game.move("c5");
    const position: CurrentPosition = {
      fen: game.fen(),
      lastMove,
      eval: evaluation("g1f3"),
      lastEval: evaluation("e7e5"),
    };
    assert.equal(game.turn(), "w");
    const uci = getBestMoveHint(position);
    assert.equal(uci, "g1f3");
    assert.equal(game.get(uci!.slice(0, 2) as Square)?.color, "w");
    assert.equal(getBestMoveSuggestion(position)?.san, "Nf3");
    assert.equal(getBestMoveSuggestion(position)?.color, "w");
    const retrospective = getPreviousBestMoveFeedback(position);
    assert.equal(retrospective?.alternative.lan, "e7e5");
    assert.equal(retrospective?.context, "Before Black played 1…c5");
    assert.equal(retrospective?.alternative.before, blackFen);
  });

  it("uses the same current-turn rule in an Arena projection", () => {
    const game = new Chess();
    game.move("e4");
    const before = game.fen();
    game.move("c5");
    const projection = projectArenaAnalysis(
      game,
      new Map([
        [before, evaluation("e7e5")],
        [game.fen(), evaluation("g1f3")],
      ]),
      true
    );
    assert.equal(getBestMoveHint(projection.position), "g1f3");
    assert.equal(getBestMoveSuggestion(projection.position)?.color, "w");
  });

  it("ignores the previous move's grade and works at the starting position", () => {
    const fen = new Chess().fen();
    for (const moveClassification of Object.values(MoveClassification)) {
      assert.equal(
        getBestMoveHint({
          fen,
          eval: { ...evaluation("e2e4"), moveClassification },
        }),
        "e2e4",
        moveClassification
      );
    }
    const game = new Chess();
    game.move("e4");
    assert.equal(
      getBestMoveSuggestion({ fen: game.fen(), eval: evaluation("c7c5") })
        ?.color,
      "b"
    );
  });

  it("uses a legal principal variation while a search has not emitted bestmove yet", () => {
    const position: CurrentPosition = {
      fen: new Chess().fen(),
      eval: { lines: evaluation("d2d4").lines },
    };
    assert.equal(getBestMoveHint(position), "d2d4");
  });

  it("rejects wrong-side, illegal, malformed, terminal and unbound suggestions", () => {
    const fen = new Chess().fen();
    for (const bestMove of ["e7e5", "e2e5", "0000", "(none)", "e2e4extra"]) {
      assert.equal(
        getBestMoveHint({ fen, eval: evaluation(bestMove) }),
        undefined
      );
    }
    assert.equal(getBestMoveHint({ eval: evaluation("e2e4") }), undefined);
    assert.equal(
      getBestMoveHint({ fen: "invalid", eval: evaluation("e2e4") }),
      undefined
    );
    assert.equal(
      getBestMoveHint({ fen, lastEval: evaluation("e7e5") }),
      undefined,
      "a prior-turn move must never be used as a pending-search fallback"
    );
    const mate = new Chess();
    for (const move of ["f3", "e5", "g4", "Qh4#"]) mate.move(move);
    assert.equal(
      getBestMoveHint({ fen: mate.fen(), eval: evaluation("a2a3") }),
      undefined
    );
  });

  it("keeps promotion legal and includes its piece", () => {
    const game = new Chess("7k/P7/8/8/8/8/8/K7 w - - 0 1");
    const position = { fen: game.fen(), eval: evaluation("a7a8n") };
    assert.equal(getBestMoveHint(position), "a7a8n");
    assert.equal(getBestMoveSuggestion(position)?.promotion, "n");
    assert.equal(
      getBestMoveHint({ ...position, eval: evaluation("a7a8") }),
      undefined
    );
  });

  it("hides a stale snapshot synchronously when the board changes turn", () => {
    const game = new Chess();
    const position = { fen: game.fen(), eval: evaluation("e2e4") };
    game.move("d4");
    assert.equal(getBestMoveHint(positionFor(position, game.fen())), undefined);
  });

  it("keeps the move grade and Visualize available when bestmove is missing", () => {
    const game = new Chess();
    const lastMove = game.move("f3");
    const feedback = getMoveFeedback({
      fen: game.fen(),
      lastMove,
      lastEval: { lines: evaluation("e2e4").lines },
      eval: {
        lines: evaluation("e7e5").lines,
        moveClassification: MoveClassification.Blunder,
      },
    });
    assert.equal(feedback.previousBestMove, undefined);
    assert.equal(feedback.classification, MoveClassification.Blunder);
    assert.equal(feedback.canVisualize, true);
  });
});
