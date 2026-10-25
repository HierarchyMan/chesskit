import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import {
  analysisLinePath,
  captureAnalysisBoard,
  exportAnalysisStudy,
  newAnalysisSession,
  replayAnalysis,
} from "@/lib/analysisSession";
import {
  decodeAnalysisSession,
  encodeAnalysisSession,
} from "@/lib/analysisSessionCodec";
import { parseStudyPgn, studyNodePath, writeStudyTree } from "@/lib/studyTree";
import { GameEval } from "@/types/eval";
import { EngineName } from "@/types/enums";
import { formatGameToDatabase } from "@/lib/chess";
import { loadGameFromText } from "@/lib/pgn";

const evaluation = (game: Chess, score = 20): GameEval => ({
  positions: Array.from({ length: game.history().length + 1 }, () => ({
    lines: [{ cp: score, depth: 12, multiPv: 1, pv: [] }],
  })),
  accuracy: { white: 90, black: 91 },
  settings: {
    engine: EngineName.Stockfish18Lite,
    depth: 12,
    multiPv: 1,
    date: "2026-10-24",
  },
});
const played = (...moves: string[]) => {
  const game = new Chess();
  for (const move of moves) game.move(move);
  return game;
};

describe("study move tree and reports", () => {
  it("preserves variations in imported database records and isolates cached parse results from edits", () => {
    const pgn =
      '[Event "Source"]\n\n1. e4 e5 (1... c5 2. Nf3 $1 {idea}) 2. Nf3 *';
    assert.equal(formatGameToDatabase(loadGameFromText(pgn), pgn).pgn, pgn);
    const edited = parseStudyPgn(pgn);
    edited.main.headers.Event = "Edited";
    edited.tree.nodes.root.children.length = 0;
    const original = parseStudyPgn(pgn);
    assert.equal(original.main.headers.Event, "Source");
    assert.equal(original.tree.nodes.root.children.length, 1);
    assert.equal(original.variations.length, 1);
  });
  it("retains NAGs and future comments while extending and editing a stored line", () => {
    let session = newAnalysisSession(played("e4", "e5"));
    const branch = loadGameFromText("1. e4 c5 $1 {idea} 2. Nf3 {future} *");
    session = captureAnalysisBoard(session, branch, true);
    session.branches[0].pgn = "1. e4 c5 $1 {idea} 2. Nf3 {future} *";
    branch.move("d6");
    session = captureAnalysisBoard(session, branch, true);
    assert.ok(session.branches[0].pgn.includes("$1"));
    const cursor = replayAnalysis(session.branches[0], 2);
    cursor.setComment("new idea");
    session = captureAnalysisBoard(session, cursor, true);
    assert.ok(session.branches[0].pgn.includes("$1"));
    assert.ok(session.branches[0].pgn.includes("new idea"));
    assert.ok(session.branches[0].pgn.includes("future"));
  });
  it("carries annotations on the shared prefix into a newly forked variation", () => {
    const pgn = "1. e4 $1 {keep this idea} e5 $2 2. Nf3 *";
    let session = newAnalysisSession(loadGameFromText(pgn), undefined, pgn);
    session = captureAnalysisBoard(session, played("e4", "c5"), true);
    assert.ok(session.branches[0].pgn.includes("$1"));
    assert.ok(session.branches[0].pgn.includes("keep this idea"));
    assert.ok(!session.branches[0].pgn.includes("$2"));
  });
  it("keeps one variation while evaluating every prefix, with one stored move edge per occurrence", () => {
    let session = newAnalysisSession(played("e4", "e5"));
    const game = played("e4", "c5");
    session = captureAnalysisBoard(session, game, true);
    const id = session.selectedLineId;
    for (const move of [
      "Nf3",
      "d6",
      "d4",
      "cxd4",
      "Nxd4",
      "Nf6",
      "Nc3",
      "a6",
    ]) {
      session.branches[0].evaluation = evaluation(game);
      game.move(move);
      session = captureAnalysisBoard(session, game, true);
      assert.equal(session.branches.length, 1);
      assert.equal(session.selectedLineId, id);
    }
    assert.equal(session.branches[0].reports?.length, 8);
    const stored = encodeAnalysisSession(session);
    assert.equal(
      Object.keys(stored.tree.nodes).length,
      game.history().length + 2
    );
    assert.equal("pgn" in stored.branches[0], false);
    const restored = decodeAnalysisSession(structuredClone(stored));
    assert.deepEqual(restored.branches[0].reports, session.branches[0].reports);
    assert.deepEqual(
      replayAnalysis(restored.branches[0]).history(),
      game.history()
    );
  });

  it("round-trips nested variations, comments, NAGs, escaped headers, Black roots and promotions", () => {
    const pgn =
      '[Event "A \\"quote\\" \\\\ test"]\n[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K b - - 0 42"]\n[Result "*"]\n\n{root} 42... Kh7 (42... Kg8 43. a8=Q+ $1 {queen} (43. a8=N {knight})) 43. a8=R {rook} *';
    const first = parseStudyPgn(pgn);
    const exported = writeStudyTree(first.tree, first.main.headers);
    const second = parseStudyPgn(exported);
    assert.deepEqual(second.tree, first.tree);
    assert.equal(second.main.headers.Event, 'A "quote" \\ test');
    assert.ok(exported.includes("$1"));
    assert.equal(second.variations.length, 2);
    const session = newAnalysisSession(
      new Chess(first.tree.rootFen),
      undefined,
      pgn
    );
    assert.equal(session.branches.length, 2);
    const reimported = parseStudyPgn(exportAnalysisStudy(session));
    assert.equal(
      Object.keys(reimported.tree.nodes).length,
      Object.keys(first.tree.nodes).length
    );
    assert.equal(
      new Chess(replayAnalysis(session.main).fen()).get("a8")?.type,
      "r"
    );
  });

  it("validates illegal nested moves instead of silently discarding variations", () => {
    assert.throws(() => parseStudyPgn("1. e4 e5 (1... Ke7) *"));
    assert.throws(() => parseStudyPgn("1. e4 (1. d4 *"), /Unclosed/);
  });

  it("migrates legacy prefix spam without losing distinct evaluations or comment snapshots", () => {
    const legacy = newAnalysisSession(played("e4", "e5"));
    const prefix = played("e4", "c5");
    prefix.setComment("Earlier report comment");
    legacy.branches = [
      { id: "short", pgn: prefix.pgn(), evaluation: evaluation(prefix) },
      { id: "long", pgn: played("e4", "c5", "Nf3", "d6").pgn() },
    ];
    legacy.selectedLineId = "short";
    legacy.cursorPly = 2;
    const restored = decodeAnalysisSession(legacy);
    assert.equal(restored.branches.length, 1);
    assert.equal(restored.selectedLineId, "long");
    assert.equal(restored.cursorPly, 2);
    assert.deepEqual(restored.branches[0].aliases, ["short"]);
    assert.equal(
      replayAnalysis(restored.branches[0].reports![0]).getComment(),
      "Earlier report comment"
    );
    assert.deepEqual(
      legacy.branches.map((line) => line.id),
      ["short", "long"]
    );
  });

  it("keeps ambiguous forks and conflicting unevaluated comments during migration", () => {
    const legacy = newAnalysisSession(played("e4", "e5"));
    legacy.branches = ["e4 c5", "e4 c5 Nf3", "e4 c5 Nc3"].map((moves, i) => ({
      id: `${i}`,
      pgn: played(...moves.split(" ")).pgn(),
    }));
    assert.equal(decodeAnalysisSession(legacy).branches.length, 3);
  });

  it("does not merge transpositions, and strips a source result from unfinished alternatives", () => {
    const original = played("Nf3", "Nf6", "g3", "g6");
    original.setHeader("Result", "1-0");
    original.setHeader("Termination", "Normal");
    let session = newAnalysisSession(original, 7);
    const alternate = played("g3", "g6", "Nf3", "Nf6");
    alternate.setHeader("Result", "1-0");
    alternate.setHeader("Termination", "Normal");
    session = captureAnalysisBoard(session, alternate, true);
    assert.equal(replayAnalysis(session.branches[0]).getHeaders().Result, "*");
    assert.equal(
      replayAnalysis(session.branches[0]).getHeaders().Termination,
      undefined
    );
    assert.equal(replayAnalysis(session.main).getHeaders().Result, "1-0");
    const compact = encodeAnalysisSession(session);
    const pathA = studyNodePath(compact.tree, compact.main.endpoint);
    const pathB = studyNodePath(compact.tree, compact.branches[0].endpoint);
    assert.notEqual(pathA.at(-1)?.id, pathB.at(-1)?.id);
    assert.deepEqual(
      analysisLinePath(decodeAnalysisSession(compact).branches[0]).moves,
      analysisLinePath(session.branches[0]).moves
    );
  });
});
