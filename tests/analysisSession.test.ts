import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { createStore } from "jotai/vanilla";
import {
  analysisSessionBackup,
  captureAnalysisBoard,
  clearAnalysisBranches,
  newAnalysisSession,
  parseAnalysisSessionBackup,
  replayAnalysis,
  copyAnalysisSession,
} from "@/lib/analysisSession";
import {
  analysisSessionAtom,
  boardAtom,
  gameAtom,
  loadAnalysisGameAtom,
  restoreAnalysisSessionAtom,
  storeAnalysisBranchesAtom,
} from "@/sections/analysis/sessionAtoms";

const game = (...moves: string[]) => {
  const value = new Chess();
  moves.forEach((move) => value.move(move));
  return value;
};

describe("analysis branch persistence option", () => {
  it("defaults fully off: legal alternatives remain interactive but never enter saved data", () => {
    const store = createStore();
    const original = game("e4", "e5", "Nf3", "Nc6");
    store.set(loadAnalysisGameAtom, { game: original });
    assert.equal(store.get(storeAnalysisBranchesAtom), false);
    store.set(boardAtom, game("e4"));
    const before = store.get(analysisSessionAtom)!;
    store.set(boardAtom, game("e4", "c5"));
    assert.equal(store.get(boardAtom).history().join(), "e4,c5");
    assert.equal(store.get(analysisSessionAtom), before);
    assert.equal(before.branches.length, 0);
    assert.equal(store.get(gameAtom).pgn(), original.pgn());
    assert.equal(
      replayAnalysis(before.main, before.cursorPly).history().join(),
      "e4"
    );
  });

  it("records actual analysis alternatives only when enabled and replays every stored line", () => {
    const store = createStore();
    store.set(loadAnalysisGameAtom, { game: game("e4", "e5", "Nf3", "Nc6") });
    store.set(storeAnalysisBranchesAtom, true);
    store.set(boardAtom, game("e4", "c5", "Nf3"));
    const first = store.get(analysisSessionAtom)!;
    assert.equal(first.branches.length, 1);
    assert.equal(store.get(gameAtom).history().join(), "e4,c5,Nf3");
    store.set(boardAtom, game("e4", "c5", "Nc3"));
    const second = store.get(analysisSessionAtom)!;
    assert.equal(second.branches.length, 2);
    assert.equal(replayAnalysis(second.main).history().join(), "e4,e5,Nf3,Nc6");
    assert.deepEqual(
      second.branches.map((line) => replayAnalysis(line).history()),
      [
        ["e4", "c5", "Nf3"],
        ["e4", "c5", "Nc3"],
      ]
    );
    store.set(restoreAnalysisSessionAtom, {
      ...second,
      selectedLineId: first.branches[0].id,
      cursorPly: 1,
    });
    assert.equal(store.get(boardAtom).history().join(), "e4");
    assert.equal(store.get(gameAtom).history()[1], "c5");
  });

  it("disabling hides/selects no stored alternative and stops writes without erasing prior branches", () => {
    const store = createStore();
    store.set(loadAnalysisGameAtom, { game: game("e4", "e5") });
    store.set(storeAnalysisBranchesAtom, true);
    store.set(boardAtom, game("e4", "c5"));
    const branch = store.get(analysisSessionAtom)!.branches[0];
    store.set(storeAnalysisBranchesAtom, false);
    assert.equal(store.get(gameAtom).history().join(), "e4,e5");
    assert.equal(store.get(analysisSessionAtom)!.selectedLineId, "main");
    store.set(boardAtom, game("e4", "c6"));
    assert.deepEqual(store.get(analysisSessionAtom)!.branches, [branch]);
    const saved = store.get(analysisSessionAtom)!;
    // Reopening an archived selected branch cannot leak it into off-mode.
    store.set(restoreAnalysisSessionAtom, {
      ...saved,
      selectedLineId: branch.id,
      cursorPly: 2,
    });
    assert.equal(store.get(boardAtom).history().length, 0);
    assert.equal(store.get(gameAtom).history().join(), "e4,e5");
  });

  it("clear removes only alternatives and enables recording fresh alternatives afterwards", () => {
    let session = newAnalysisSession(game("e4", "e5"));
    session = captureAnalysisBoard(session, game("e4", "c5"), true);
    const main = session.main.pgn;
    session = clearAnalysisBranches(session);
    assert.equal(session.branches.length, 0);
    assert.equal(session.main.pgn, main);
    session = captureAnalysisBoard(session, game("e4", "c6"), true);
    assert.equal(session.branches.length, 1);
    assert.equal(replayAnalysis(session.branches[0]).history().join(), "e4,c6");
  });

  it("extends a line once, reuses it during navigation, and does not duplicate variations", () => {
    let session = newAnalysisSession(game("e4", "e5"));
    session = captureAnalysisBoard(session, game("e4", "c5"), true);
    session = captureAnalysisBoard(session, game("e4", "c5", "Nf3"), true);
    session = captureAnalysisBoard(session, game("e4"), true);
    session = captureAnalysisBoard(session, game("e4", "c5"), true);
    assert.equal(session.branches.length, 1);
    assert.equal(replayAnalysis(session.branches[0]).history().length, 3);
    assert.equal(session.cursorPly, 2);
  });
});

describe("analysis archival and source identity", () => {
  it("preserves an unfinished arrangement and FEN input without applying or discarding it", () => {
    const session = newAnalysisSession();
    session.draft = {
      pieces: {},
      turn: "b",
      castling: { K: false, Q: false, k: false, q: false },
      enPassant: null,
      halfmove: 0,
      fullmove: 42,
    };
    session.draftInput = "unfinished input";
    const restored = parseAnalysisSessionBackup(analysisSessionBackup(session));
    assert.deepEqual(restored.draft, session.draft);
    assert.equal(restored.draftInput, session.draftInput);
    assert.equal(restored.main.pgn, session.main.pgn);
  });

  it("restoring a backup uses a new identity and clears its old storage revision", () => {
    const original = { ...newAnalysisSession(game("e4", "e5")), revision: 27 };
    const copy = copyAnalysisSession(
      parseAnalysisSessionBackup(analysisSessionBackup(original))
    );
    assert.notEqual(copy.id, original.id);
    assert.equal(copy.revision, undefined);
    assert.deepEqual(copy.main, original.main);
  });
  it("round-trips full games, headers, comments, branches, cursor and source without rewriting them", () => {
    const original = game("e4", "e5", "Nf3");
    original.setHeader("Event", "Preservation fixture");
    original.setHeader("CustomTag", "keep me");
    original.setComment("A comment with punctuation !?");
    let session = newAnalysisSession(original, 42);
    const alternate = game("e4", "c5");
    alternate.setComment("Sicilian idea");
    session = captureAnalysisBoard(session, alternate, true);
    const restored = parseAnalysisSessionBackup(analysisSessionBackup(session));
    assert.deepEqual(restored, session);
    assert.equal(restored.sourceGameId, 42);
    assert.equal(restored.sourcePgn, original.pgn());
    assert.equal(
      replayAnalysis(restored.main).getHeaders().CustomTag,
      "keep me"
    );
    assert.equal(
      replayAnalysis(restored.branches[0]).getComment(),
      "Sicilian idea"
    );
  });

  it("saves zero-move custom positions and resets explicitly to equal roots after exploration", () => {
    const store = createStore();
    const root = new Chess("4k3/8/8/8/8/8/1R6/4K3 b - - 17 42");
    root.setHeader("Event", "Original metadata");
    store.set(loadAnalysisGameAtom, { game: root });
    const copy = new Chess(root.fen());
    copy.move("Kd7");
    store.set(boardAtom, copy);
    const firstId = store.get(analysisSessionAtom)!.id;
    root.setHeader("Event", "Updated metadata");
    store.set(loadAnalysisGameAtom, { game: root });
    assert.equal(store.get(boardAtom).fen(), root.fen());
    assert.equal(store.get(boardAtom).history().length, 0);
    assert.equal(store.get(gameAtom).getHeaders().Event, "Updated metadata");
    assert.notEqual(store.get(analysisSessionAtom)!.id, firstId);
    assert.equal(
      parseAnalysisSessionBackup(
        analysisSessionBackup(store.get(analysisSessionAtom)!)
      ).main.pgn,
      root.pgn()
    );
  });

  it("keeps Black-to-move numbering and promotion in exact replay", () => {
    const root = new Chess("7k/P7/8/8/8/8/8/7K b - - 0 42");
    root.move("Kh7");
    root.move({ from: "a7", to: "a8", promotion: "n" });
    const session = newAnalysisSession(root);
    const restored = parseAnalysisSessionBackup(analysisSessionBackup(session));
    assert.equal(replayAnalysis(restored.main).fen(), root.fen());
    assert.equal(
      replayAnalysis(restored.main).history({ verbose: true })[1].promotion,
      "n"
    );
    assert.equal(replayAnalysis(restored.main, 0).turn(), "b");
  });

  it("refuses malformed/colliding line IDs, illegal moves, wrong roots and invalid replay cursors", () => {
    const valid = newAnalysisSession(game("e4", "e5"));
    for (const session of [
      { ...valid, cursorPly: 99 },
      { ...valid, selectedLineId: "gone" },
      { ...valid, branches: [{ id: "main", pgn: valid.main.pgn }] },
      { ...valid, branches: [{ id: "bad", pgn: "1. e4 Ke7" }] },
      {
        ...valid,
        branches: [
          {
            id: "different",
            pgn: new Chess("4k3/8/8/8/8/8/1R6/4K3 b - - 0 42").pgn(),
          },
        ],
      },
    ])
      assert.throws(() =>
        parseAnalysisSessionBackup(analysisSessionBackup(session))
      );
    assert.throws(() => parseAnalysisSessionBackup('{"format":"another-app"}'));
  });
});
