import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { createStore } from "jotai/vanilla";
import {
  analysisSessionBackup,
  captureAnalysisBoard,
  newAnalysisSession,
  parseAnalysisSessionBackup,
  replayAnalysis,
  sessionLine,
} from "@/lib/analysisSession";
import {
  analysisSessionAtom,
  boardAtom,
  gameAtom,
  gameEvalAtom,
  navigateAnalysisAtom,
  restoreAnalysisSessionAtom,
  rememberAnalysisAtom,
} from "@/sections/analysis/sessionAtoms";
import { EngineName } from "@/types/enums";
import { GameEval } from "@/types/eval";

const game = (...moves: string[]) => {
  const value = new Chess();
  for (const move of moves) value.move(move);
  return value;
};
const evaluation = (value: Chess): GameEval => ({
  positions: Array.from({ length: value.history().length + 1 }, () => ({
    lines: [{ cp: 20, depth: 12, multiPv: 1, pv: [] }],
  })),
  accuracy: { white: 100, black: 100 },
  settings: {
    engine: EngineName.Stockfish18Lite,
    depth: 12,
    multiPv: 1,
    date: new Date().toISOString(),
  },
});

describe("Remember continuations", () => {
  it("seeds an invented game on its first move, then keeps one growing continuation across later plies", () => {
    let session = newAnalysisSession();
    session = captureAnalysisBoard(session, game("a3"), true);
    assert.deepEqual(replayAnalysis(session.main).history(), ["a3"]);
    assert.equal(session.branches.length, 0);
    session = captureAnalysisBoard(session, game("a3", "h6"), true);
    const continuationId = session.selectedLineId;
    assert.equal(continuationId, "main");
    for (const moves of [
      ["a3", "h6", "b3"],
      ["a3", "h6", "b3", "g6"],
    ]) {
      session = captureAnalysisBoard(session, game(...moves), true);
      assert.equal(session.branches.length, 0);
      assert.equal(session.selectedLineId, continuationId);
      assert.deepEqual(replayAnalysis(sessionLine(session)).history(), moves);
    }
  });

  it("preserves a complete main game and its evaluation while recording and replaying a growing continuation", () => {
    const original = game("e4", "e5");
    original.setHeader("Event", "Preserved source");
    original.setComment("Original endpoint");
    const session = newAnalysisSession(original, 7);
    session.main.evaluation = evaluation(original);
    session.cursorPly = 2;
    const store = createStore();
    store.set(restoreAnalysisSessionAtom, session);
    store.set(rememberAnalysisAtom, true);
    const extended = replayAnalysis(session.main);
    extended.move("Nf3");
    store.set(boardAtom, extended);
    const first = store.get(analysisSessionAtom)!;
    assert.deepEqual(first.main, session.main);
    assert.equal(first.sourcePgn, original.pgn());
    assert.equal(first.branches.length, 1);
    assert.equal(store.get(gameEvalAtom), undefined);
    const id = first.selectedLineId;
    extended.move("Nc6");
    store.set(boardAtom, extended);
    const completed = store.get(analysisSessionAtom)!;
    assert.equal(completed.branches.length, 1);
    assert.equal(completed.selectedLineId, id);
    assert.deepEqual(completed.main, session.main);
    store.set(navigateAnalysisAtom, "previous");
    store.set(navigateAnalysisAtom, "previous");
    assert.equal(store.get(analysisSessionAtom)!.selectedLineId, id);
    assert.deepEqual(store.get(boardAtom).history(), ["e4", "e5"]);
    store.set(navigateAnalysisAtom, "end");
    assert.deepEqual(store.get(boardAtom).history(), [
      "e4",
      "e5",
      "Nf3",
      "Nc6",
    ]);
    store.set(rememberAnalysisAtom, false);
    const restored = parseAnalysisSessionBackup(
      analysisSessionBackup(completed)
    );
    store.set(restoreAnalysisSessionAtom, restored);
    assert.equal(store.get(analysisSessionAtom)!.selectedLineId, id);
    store.set(restoreAnalysisSessionAtom, {
      ...restored,
      selectedLineId: "main",
      cursorPly: 2,
    });
    assert.deepEqual(store.get(gameAtom).history(), ["e4", "e5"]);
    assert.deepEqual(store.get(gameEvalAtom), session.main.evaluation);
  });

  it("preserves nonempty unevaluated main lines too, while a pristine empty main can seed an invented game", () => {
    const original = newAnalysisSession(game("d4", "d5"));
    const extended = captureAnalysisBoard(
      original,
      game("d4", "d5", "c4"),
      true
    );
    assert.deepEqual(extended.main, original.main);
    assert.equal(extended.branches.length, 1);
    assert.deepEqual(replayAnalysis(sessionLine(extended)).history(), [
      "d4",
      "d5",
      "c4",
    ]);
    const blank = newAnalysisSession();
    const seeded = captureAnalysisBoard(blank, game("a3", "h6"), true);
    assert.equal(seeded.branches.length, 0);
    assert.equal(seeded.selectedLineId, "main");
    assert.deepEqual(replayAnalysis(seeded.main).history(), ["a3", "h6"]);
    const evaluatedRoot = newAnalysisSession();
    evaluatedRoot.main.evaluation = evaluation(new Chess());
    const fork = captureAnalysisBoard(evaluatedRoot, game("a3"), true);
    assert.deepEqual(
      fork.main.reports?.[0].evaluation,
      evaluatedRoot.main.evaluation
    );
    assert.equal(fork.branches.length, 0);
    assert.deepEqual(replayAnalysis(fork.main).history(), ["a3"]);
  });

  it("extends evaluated alternatives in place and retains the evaluated prefix as a report", () => {
    let session = captureAnalysisBoard(
      newAnalysisSession(game("e4", "e5")),
      game("e4", "c5"),
      true
    );
    const savedBranch = {
      ...session.branches[0],
      evaluation: evaluation(game("e4", "c5")),
    };
    session = { ...session, branches: [savedBranch] };
    session = captureAnalysisBoard(session, game("e4", "c5", "Nf3"), true);
    const continuationId = session.selectedLineId;
    assert.equal(continuationId, savedBranch.id);
    assert.deepEqual(
      session.branches[0].reports?.[0].evaluation,
      savedBranch.evaluation
    );
    assert.equal(session.branches[0].reports?.[0].pgn, savedBranch.pgn);
    assert.equal(session.branches[0].evaluation, undefined);
    session = captureAnalysisBoard(
      session,
      game("e4", "c5", "Nf3", "d6"),
      true
    );
    assert.equal(session.branches.length, 1);
    assert.equal(session.selectedLineId, continuationId);
    const restored = parseAnalysisSessionBackup(analysisSessionBackup(session));
    assert.deepEqual(restored.branches[0].reports, session.branches[0].reports);
    assert.deepEqual(replayAnalysis(sessionLine(restored)).history(), [
      "e4",
      "c5",
      "Nf3",
      "d6",
    ]);
  });

  it("uses the most specific mutable continuation rather than overwriting another saved prefix", () => {
    const session = newAnalysisSession(game("e4", "e5"));
    const short = { id: "short", pgn: game("e4", "e5", "Nf3").pgn() };
    const long = { id: "long", pgn: game("e4", "e5", "Nf3", "Nc6").pgn() };
    session.branches = [short, long];
    session.selectedLineId = short.id;
    const captured = captureAnalysisBoard(
      session,
      game("e4", "e5", "Nf3", "Nc6", "Bb5"),
      true
    );
    assert.deepEqual(captured.main, session.main);
    assert.deepEqual(captured.branches[0], short);
    assert.equal(captured.selectedLineId, long.id);
    assert.equal(captured.branches.length, 2);
    assert.deepEqual(replayAnalysis(sessionLine(captured)).history(), [
      "e4",
      "e5",
      "Nf3",
      "Nc6",
      "Bb5",
    ]);
  });

  it("off leaves stored lines intact and on resumes the same continuation without altering the main game", () => {
    const original = newAnalysisSession(game("d4", "d5"));
    const store = createStore();
    store.set(restoreAnalysisSessionAtom, original);
    store.set(rememberAnalysisAtom, true);
    store.set(boardAtom, game("d4", "d5", "c4"));
    const saved = store.get(analysisSessionAtom)!;
    store.set(rememberAnalysisAtom, false);
    store.set(boardAtom, game("d4", "d5", "c4", "e6"));
    assert.equal(store.get(analysisSessionAtom), saved);
    store.set(rememberAnalysisAtom, true);
    store.set(boardAtom, game("d4", "d5", "c4", "e6", "Nc3"));
    const resumed = store.get(analysisSessionAtom)!;
    assert.equal(resumed.branches.length, 1);
    assert.equal(resumed.selectedLineId, saved.selectedLineId);
    assert.deepEqual(resumed.main, original.main);
    assert.deepEqual(replayAnalysis(sessionLine(resumed)).history(), [
      "d4",
      "d5",
      "c4",
      "e6",
      "Nc3",
    ]);
  });
});
