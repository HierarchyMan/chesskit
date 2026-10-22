import assert from "node:assert/strict";
import { it } from "node:test";
import { Chess } from "chess.js";
import { atom, createStore, getDefaultStore, Provider } from "jotai";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useChessActions } from "@/hooks/useChessActions";
import { soundEnabledAtom } from "@/components/board/states";

it("chess actions read the latest atom for rapid moves, takebacks and comments without a render", () => {
  const store = createStore();
  const board = atom(new Chess());
  let actions: ReturnType<typeof useChessActions>;
  function Probe() {
    actions = useChessActions(board);
    return null;
  }
  getDefaultStore().set(soundEnabledAtom, false);
  renderToStaticMarkup(
    createElement(Provider, { store }, createElement(Probe))
  );
  const staleRoot = store.get(board);
  assert.ok(actions!.playMove({ from: "e2", to: "e4" }));
  assert.equal(actions!.playMove({from:"e7",to:"e5"}, staleRoot), null, "a stale proposal must not become a move on a newer path");
  actions!.addMoves(["c5"], staleRoot);
  assert.deepEqual(store.get(board).history(), ["e4"]);
  assert.ok(actions!.playMove({ from: "e7", to: "e5" }));
  assert.ok(actions!.playMove({ from: "g1", to: "f3" }));
  assert.deepEqual(store.get(board).history(), ["e4", "e5", "Nf3"]);
  actions!.setComment("current, not the rendered root");
  assert.equal(store.get(board).getComment(), "current, not the rendered root");
  actions!.undoMove();
  actions!.undoMove();
  assert.deepEqual(store.get(board).history(), ["e4"]);
  actions!.addMoves(["c5", "not a legal move"]);
  assert.deepEqual(
    store.get(board).history(),
    ["e4"],
    "invalid line must apply atomically"
  );
  actions!.addMoves(["c5", "Nf3"]);
  assert.deepEqual(store.get(board).history(), ["e4", "c5", "Nf3"]);
  for (const invalid of [-1, 0.5, NaN, 99])
    actions!.goToMove(invalid, store.get(board));
  assert.equal(store.get(board).history().length, 3);
});
