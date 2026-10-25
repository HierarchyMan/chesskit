import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createStore } from "jotai/vanilla";
import { createEditorAtoms } from "@/lib/editorState";
import {
  placePiece,
  positionFromFen,
  positionToFen,
  START_FEN,
} from "@/lib/editorPosition";
import { matchMotionPieces } from "@/lib/boardMotion";
import { setupPosition, playSetupPosition } from "@/lib/setupPosition";
import { Color } from "@/types/enums";
import { Chess } from "chess.js";

describe("editor effective position and history", () => {
  it("shows valid FEN immediately, discards a stale draft on board edits, and replays rapid undo/redo exactly", () => {
    const editor = createEditorAtoms();
    const store = createStore();
    const fen = "4k3/8/8/8/8/8/1R6/4K3 b - - 17 42";
    store.set(editor.draft, fen);
    assert.equal(positionToFen(store.get(editor.position)), fen);
    store.set(editor.position, (position) => placePiece(position, "a1", "wQ"));
    assert.equal(store.get(editor.draft), null);
    const edited = positionToFen(store.get(editor.position));
    store.set(editor.undo);
    assert.equal(positionToFen(store.get(editor.position)), fen);
    store.set(editor.undo);
    assert.equal(positionToFen(store.get(editor.position)), START_FEN);
    store.set(editor.redo);
    store.set(editor.redo);
    assert.equal(positionToFen(store.get(editor.position)), edited);
    store.set(editor.undo);
    store.set(editor.position, (position) => placePiece(position, "b1", "wN"));
    assert.equal(store.get(editor.history).future.length, 0);
  });
  it("preserves unfinished input on restore, blocks its use, and lets the next board action become authoritative", () => {
    const editor = createEditorAtoms();
    const store = createStore();
    store.set(editor.reset, {
      position: positionFromFen(START_FEN),
      draft: "unfinished input",
    });
    assert.equal(store.get(editor.draft), "unfinished input");
    assert.equal(store.get(editor.history).past.length, 0);
    store.set(editor.position, (position) => placePiece(position, "a2", null));
    assert.equal(store.get(editor.draft), null);
    assert.equal(store.get(editor.position).pieces.a2, undefined);
    store.set(editor.undo);
    assert.equal(store.get(editor.draft), "unfinished input");
    assert.equal(store.get(editor.position).pieces.a2, "wP");
    store.set(editor.redo);
    assert.equal(store.get(editor.draft), null);
    assert.equal(store.get(editor.position).pieces.a2, undefined);
    store.set(editor.draft, "unfinished again");
    store.set(editor.position, (position) => position);
    assert.equal(store.get(editor.draft), null);
    store.set(editor.undo);
    assert.equal(store.get(editor.draft), "unfinished again");
  });
});

describe("piece presentation identity", () => {
  it("moves both castling pieces, restores captures, and reuses promotion identities on undo", () => {
    let serial = 0;
    const id = () => `${++serial}`;
    const before = [
      { id: "king", square: "e1", piece: "wK" },
      { id: "rook", square: "h1", piece: "wR" },
      { id: "pawn", square: "a7", piece: "wP" },
    ];
    const castled = matchMotionPieces(
      before,
      { g1: "wK", f1: "wR", a8: "wQ" },
      id
    );
    assert.deepEqual(
      castled.pieces.map((piece) => [piece.id, piece.square]),
      [
        ["king", "g1"],
        ["rook", "f1"],
        ["pawn", "a8"],
      ]
    );
    const undo = matchMotionPieces(
      castled.pieces,
      { e1: "wK", h1: "wR", a7: "wP" },
      id
    );
    assert.deepEqual(undo.pieces, before);
    const capture = matchMotionPieces(before, { e1: "wK", a7: "wR" }, id);
    assert.equal(
      capture.pieces.find((piece) => piece.square === "a7")?.id,
      "rook"
    );
    assert.equal(capture.removed[0].id, "pawn");
  });
});

describe("setup previews", () => {
  it("shares type/paste/clear/invalid/finished behavior across setup and Start", () => {
    const fen = "4k3/8/8/8/8/8/1R6/4K3 b - - 17 42";
    assert.equal(setupPosition(fen).fen, fen);
    assert.equal(playSetupPosition(fen, "none", Color.Black).fen, fen);
    assert.equal(setupPosition("").fen, new Chess().fen());
    assert.ok(setupPosition("unfinished input").error);
    assert.equal(setupPosition("unfinished input").fen, new Chess().fen());
    assert.equal(
      setupPosition("1. e4 e5 2. Nf3 *").fen,
      (() => {
        const board = new Chess();
        board.loadPgn("1. e4 e5 2. Nf3 *");
        return board.fen();
      })()
    );
    assert.ok(setupPosition("7k/5Q2/7K/8/8/8/8/8 b - - 0 1").error);
  });
});
