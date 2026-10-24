import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { createStore } from "jotai/vanilla";
import { chessPathKey } from "@/lib/chessHistory";
import {
  effectiveMoveSide,
  getFenForSide,
  linesToTopMoves,
  MoveSideChoice,
  resetMoveSideChoice,
} from "@/lib/engine/topMoves";
import {
  requestTopMoves,
  topMovesFor,
  TopMovesRequest,
  TopMovesSnapshot,
} from "@/lib/engine/topMovesRequest";
import {
  analysisBoardKeyAtom,
  boardArrowsAtom,
  boardAtom,
  loadAnalysisGameAtom,
  navigateAnalysisAtom,
  topMovesSideAtom,
} from "@/sections/analysis/sessionAtoms";
import {
  gameAtom,
  gameIdAtom,
  hintArrowsAtom,
  hintPositionKeyAtom,
} from "@/sections/play/states";
import { EvaluatePositionWithUpdateParams, PositionEval } from "@/types/eval";
import { BoardArrow } from "@/lib/arrows/types";

const position = (...moves: string[]) => {
  const game = new Chess();
  moves.forEach((move) => game.move(move));
  return game;
};
const result = (move: string): PositionEval => ({
  lines: [{ pv: [move], depth: 14, multiPv: 1, cp: 30 }],
});
const blackArrow: BoardArrow[] = [
  { from: "e7", to: "e5", kind: "best", side: "b" },
];
const whiteArrow: BoardArrow[] = [
  { from: "g1", to: "f3", kind: "best", side: "w" },
];

describe("Play hint side follows the current position", () => {
  it("keeps an explicit opponent what-if on the unchanged position", () => {
    const game = position("e4", "e5");
    const key = `4|${chessPathKey(game)}`;
    const choice: MoveSideChoice = {
      side: "opponent",
      fen: game.fen(),
      positionKey: key,
    };
    assert.equal(resetMoveSideChoice(choice, game.fen(), key), choice);
    assert.equal(effectiveMoveSide(choice, game.fen(), key), "opponent");
    const query = getFenForSide(game.fen(), "opponent");
    assert.ok("fen" in query && query.fen.split(" ")[1] === "b");
  });

  it("defaults to the mover after a reply and does not revive the old what-if on takeback", () => {
    const before = position("e4", "e5");
    let choice: MoveSideChoice = {
      side: "opponent",
      fen: before.fen(),
      positionKey: chessPathKey(before),
    };
    const after = position("e4", "e5", "Nf3", "Nc6");
    choice = resetMoveSideChoice(choice, after.fen(), chessPathKey(after));
    assert.equal(
      effectiveMoveSide(choice, after.fen(), chessPathKey(after)),
      "mover"
    );
    choice = resetMoveSideChoice(choice, before.fen(), chessPathKey(before));
    assert.equal(
      effectiveMoveSide(choice, before.fen(), chessPathKey(before)),
      "mover"
    );
    const query = getFenForSide(before.fen(), choice.side);
    assert.ok("fen" in query && query.fen.split(" ")[1] === "w");
  });

  it("resets on another path to the same FEN and a new game at the same FEN", () => {
    const first = position("Nf3", "Nf6", "Nc3", "Nc6");
    const second = position("Nc3", "Nc6", "Nf3", "Nf6");
    assert.equal(first.fen(), second.fen());
    const key = `7|${chessPathKey(first)}`;
    const choice: MoveSideChoice = {
      side: "opponent",
      fen: first.fen(),
      positionKey: key,
    };
    for (const nextKey of [
      `7|${chessPathKey(second)}`,
      `8|${chessPathKey(first)}`,
    ]) {
      assert.equal(
        resetMoveSideChoice(choice, first.fen(), nextKey).side,
        "mover"
      );
      assert.equal(effectiveMoveSide(choice, first.fen(), nextKey), "mover");
    }
  });

  it("resets Analysis's saved side even while top moves is closed", () => {
    const store = createStore();
    store.set(loadAnalysisGameAtom, { game: position("e4", "e5") });
    store.set(navigateAnalysisAtom, "end");
    const board = store.get(boardAtom);
    store.set(topMovesSideAtom, {
      side: "opponent",
      fen: board.fen(),
      positionKey: store.get(analysisBoardKeyAtom),
    });
    store.set(navigateAnalysisAtom, "previous");
    store.set(navigateAnalysisAtom, "next");
    assert.equal(store.get(topMovesSideAtom).side, "mover");
    store.set(topMovesSideAtom, {
      side: "opponent",
      fen: board.fen(),
      positionKey: store.get(analysisBoardKeyAtom),
    });
    store.set(loadAnalysisGameAtom, { game: position("e4", "e5") });
    assert.equal(store.get(topMovesSideAtom).side, "mover");
  });
});

describe("top-move lists and arrows reject old position ownership", () => {
  it("hides Play arrows immediately when the turn changes and rejects stale publish/cleanup", () => {
    const store = createStore();
    store.set(gameAtom, position("e4"));
    const oldKey = store.get(hintPositionKeyAtom);
    store.set(hintArrowsAtom, { positionKey: oldKey, arrows: blackArrow });
    assert.deepEqual(store.get(hintArrowsAtom), blackArrow);
    store.set(gameAtom, position("e4", "e5"));
    assert.deepEqual(store.get(hintArrowsAtom), []);
    const currentKey = store.get(hintPositionKeyAtom);
    store.set(hintArrowsAtom, { positionKey: currentKey, arrows: whiteArrow });
    store.set(hintArrowsAtom, { positionKey: oldKey, arrows: blackArrow });
    store.set(hintArrowsAtom, { positionKey: oldKey, arrows: [] });
    assert.deepEqual(store.get(hintArrowsAtom), whiteArrow);
    store.set(gameIdAtom, store.get(gameIdAtom) + 1);
    assert.deepEqual(store.get(hintArrowsAtom), []);
  });

  it("hides arrows for a different path at the same FEN", () => {
    const store = createStore();
    store.set(gameAtom, position("Nf3", "Nf6", "Nc3", "Nc6"));
    store.set(hintArrowsAtom, whiteArrow);
    store.set(gameAtom, position("Nc3", "Nc6", "Nf3", "Nf6"));
    assert.deepEqual(store.get(hintArrowsAtom), []);
  });

  it("hides Analysis arrows during navigation before the panel requests again", () => {
    const store = createStore();
    store.set(loadAnalysisGameAtom, { game: position("e4", "e5") });
    store.set(navigateAnalysisAtom, "next");
    const oldKey = store.get(analysisBoardKeyAtom);
    store.set(boardArrowsAtom, { positionKey: oldKey, arrows: blackArrow });
    store.set(navigateAnalysisAtom, "next");
    assert.deepEqual(store.get(boardArrowsAtom), []);
    store.set(boardArrowsAtom, { positionKey: oldKey, arrows: blackArrow });
    assert.deepEqual(store.get(boardArrowsAtom), []);
    store.set(navigateAnalysisAtom, "previous");
    assert.deepEqual(store.get(boardArrowsAtom), []);
  });

  it("discards illegal first moves rather than presenting raw wrong-side UCI suggestions", () => {
    const moves = linesToTopMoves(
      new Chess().fen(),
      [...result("e7e5").lines, ...result("e2e4").lines],
      1
    );
    assert.deepEqual(
      moves.map((move) => [move.rank, move.san]),
      [[1, "e4"]]
    );
  });
});

describe("top-move request lifetime", () => {
  const requestFor = (engine: TopMovesRequest["engine"]): TopMovesRequest => ({
    engine,
    fen: new Chess().fen(),
    side: "mover",
    positionKey: "game-1",
    depth: 14,
    count: 3,
  });

  it("hides the previous snapshot before effects for side, path, engine and depth changes", () => {
    const request = requestFor(null);
    const snapshot: TopMovesSnapshot = {
      request,
      status: "done",
      moves: linesToTopMoves(request.fen, result("e2e4").lines),
    };
    assert.equal(topMovesFor(snapshot, request), snapshot);
    for (const next of [
      { ...request, side: "opponent" as const },
      { ...request, positionKey: "another-path" },
      { ...request, depth: 18 },
      {
        ...request,
        engine: {
          getIsReady: () => true,
          evaluatePositionWithUpdate: async () => result("d2d4"),
        },
      },
    ]) {
      assert.deepEqual(topMovesFor(snapshot, next).moves, []);
      assert.equal(topMovesFor(snapshot, next).status, "loading");
    }
  });

  it("ignores delayed partial and final output after a position change or unmount", async () => {
    let params: EvaluatePositionWithUpdateParams | undefined;
    let finish!: (value: PositionEval) => void;
    const engine = {
      getIsReady: () => true,
      evaluatePositionWithUpdate: (value: EvaluatePositionWithUpdateParams) => {
        params = value;
        return new Promise<PositionEval>((resolve) => {
          finish = resolve;
        });
      },
    };
    const request = requestFor(engine);
    const states: TopMovesSnapshot[] = [];
    let active = true;
    const pending = requestTopMoves(
      request,
      (state) => states.push(state),
      () => active
    );
    params?.setPartialEval?.(result("e2e4"));
    assert.equal(states.at(-1)?.moves[0].san, "e4");
    active = false;
    const count = states.length;
    params?.setPartialEval?.(result("d2d4"));
    finish(result("d2d4"));
    await pending;
    assert.equal(states.length, count);
  });

  it("ignores a late error from an engine that has been replaced", async () => {
    let fail!: (reason: Error) => void;
    const request = requestFor({
      getIsReady: () => true,
      evaluatePositionWithUpdate: () =>
        new Promise<PositionEval>((_resolve, reject) => {
          fail = reject;
        }),
    });
    let active = true;
    const states: TopMovesSnapshot[] = [];
    const pending = requestTopMoves(
      request,
      (state) => states.push(state),
      () => active
    );
    active = false;
    fail(new Error("old engine closed"));
    await pending;
    assert.deepEqual(
      states.map((state) => state.status),
      ["loading"]
    );
  });

  it("queries White by default and retains the explicit Black what-if", async () => {
    const queried: string[] = [];
    const request = requestFor({
      getIsReady: () => true,
      evaluatePositionWithUpdate: async ({ fen }) => {
        queried.push(fen);
        return result(fen.split(" ")[1] === "w" ? "e2e4" : "e7e5");
      },
    });
    const states: TopMovesSnapshot[] = [];
    await requestTopMoves(
      request,
      (state) => states.push(state),
      () => true
    );
    assert.equal(states.at(-1)?.moves[0].san, "e4");
    await requestTopMoves(
      { ...request, side: "opponent" },
      (state) => states.push(state),
      () => true
    );
    assert.equal(states.at(-1)?.moves[0].san, "e5");
    assert.deepEqual(
      queried.map((fen) => fen.split(" ")[1]),
      ["w", "b"]
    );
  });
});
