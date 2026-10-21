import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import {
  ArenaAnalysisSession,
  ArenaAnalysisUpdate,
  arenaTerminalEval,
  projectArenaAnalysis,
} from "@/lib/engine/arenaAnalysis";
import { MoveClassification } from "@/types/enums";
import { PositionEval } from "@/types/eval";

const score = (cp = 0, bestMove = "e2e4"): PositionEval => ({
  bestMove,
  lines: [
    { cp, depth: 12, multiPv: 1, pv: [bestMove] },
    { cp: cp - 10, depth: 12, multiPv: 2, pv: ["d2d4"] },
    { cp: cp - 20, depth: 12, multiPv: 3, pv: ["g1f3"] },
  ],
});
const gameWith = (...moves: string[]) => {
  const game = new Chess();
  moves.forEach((move) => game.move(move));
  return game;
};
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function deferredEvaluator() {
  const calls: string[] = [];
  const pending: ((evaluation: PositionEval) => void)[] = [];
  return {
    calls,
    evaluate: (fen: string) => {
      calls.push(fen);
      return new Promise<PositionEval>((resolve) => pending.push(resolve));
    },
    finish: (evaluation = score()) => {
      const resolve = pending.shift();
      assert.ok(resolve, "there must be an actual pending search");
      resolve(evaluation);
    },
  };
}

describe("arena evaluation scheduling", () => {
  it("evaluates only the current position when only the bar is requested", async () => {
    const game = gameWith("e4", "e5", "Nf3");
    const calls: string[] = [];
    const session = new ArenaAnalysisSession(
      async (fen) => {
        calls.push(fen);
        return score();
      },
      () => {}
    );
    session.update(game, false, false);
    await tick();
    assert.deepEqual(calls, [game.fen()]);
    session.dispose();
  });

  it("can enable annotations later and backfills every missing position once", async () => {
    const game = gameWith("e4", "e5", "Nf3");
    const calls: string[] = [];
    let update: ArenaAnalysisUpdate | undefined;
    const session = new ArenaAnalysisSession(
      async (fen) => {
        calls.push(fen);
        return score();
      },
      (value) => {
        update = value;
      }
    );
    session.update(game, false, false);
    await tick();
    session.update(game, true, false);
    await tick();
    assert.equal(calls[0], game.fen());
    assert.equal(new Set(calls).size, 4);
    assert.equal(calls.length, 4);
    assert.equal(update?.busy, false);
    const projection = projectArenaAnalysis(game, update!.evaluations, true);
    assert.equal(projection.moves.length, 3);
    assert.ok(projection.moves.every((move) => move.after?.moveClassification));
    session.dispose();
  });

  it("finishes in-flight work, prioritizes the latest game, then catches up fast moves", async () => {
    const fake = deferredEvaluator();
    let update: ArenaAnalysisUpdate | undefined;
    const session = new ArenaAnalysisSession(fake.evaluate, (value) => {
      update = value;
    });
    session.update(new Chess(), true, true);
    const game = gameWith("e4", "e5");
    session.update(gameWith("e4"), true, true);
    session.update(game, true, true);
    assert.equal(fake.calls.length, 1, "searches must not overlap");
    fake.finish();
    await tick();
    assert.equal(
      fake.calls[1],
      game.fen(),
      "current board has priority over backlog"
    );
    fake.finish(score(15, "g1f3"));
    await tick();
    assert.equal(fake.calls[2], gameWith("e4").fen());
    fake.finish(score(20, "e7e5"));
    await tick();
    assert.equal(update?.busy, false);
    assert.equal(
      projectArenaAnalysis(game, update!.evaluations, true).moves.length,
      2
    );
    session.dispose();
  });

  it("an arrow alone evaluates the last move's before position without the whole backlog", async () => {
    const game = gameWith("e4", "e5", "Nf3");
    const calls: string[] = [];
    const session = new ArenaAnalysisSession(
      async (fen) => {
        calls.push(fen);
        return score();
      },
      () => {}
    );
    session.update(game, false, true);
    await tick();
    assert.deepEqual(calls, [
      game.fen(),
      game.history({ verbose: true }).at(-1)!.before,
    ]);
    session.dispose();
  });

  it("replaces a branch during a pending search and never projects abandoned moves", async () => {
    const fake = deferredEvaluator();
    let update: ArenaAnalysisUpdate | undefined;
    const session = new ArenaAnalysisSession(fake.evaluate, (value) => {
      update = value;
    });
    session.update(gameWith("e4", "e5"), true, true);
    const branch = gameWith("e4", "c5");
    session.update(branch, true, true);
    fake.finish();
    await tick();
    assert.equal(fake.calls[1], branch.fen());
    fake.finish();
    await tick();
    fake.finish();
    await tick();
    fake.finish();
    await tick();
    const projection = projectArenaAnalysis(branch, update!.evaluations, true);
    assert.deepEqual(
      projection.moves.map((entry) => entry.move.san),
      ["e4", "c5"]
    );
    const start = projectArenaAnalysis(new Chess(), update!.evaluations, true);
    assert.equal(start.moves.length, 0);
    assert.equal(start.position.lastMove, undefined);
    session.dispose();
  });

  it("does not publish or start another search after disposal", async () => {
    const fake = deferredEvaluator();
    const updates: ArenaAnalysisUpdate[] = [];
    const session = new ArenaAnalysisSession(fake.evaluate, (value) =>
      updates.push(value)
    );
    session.update(gameWith("e4"), true, true);
    const count = updates.length;
    session.dispose();
    fake.finish();
    await tick();
    session.update(new Chess(), true, true);
    assert.equal(updates.length, count);
    assert.equal(fake.calls.length, 1);
  });

  it("reports a failed or empty engine result and a replacement session can recover", async () => {
    for (const evaluate of [
      async () => {
        throw new Error("Disconnected");
      },
      async () => ({ lines: [] }),
    ]) {
      let update: ArenaAnalysisUpdate | undefined;
      const session = new ArenaAnalysisSession(evaluate, (value) => {
        update = value;
      });
      session.update(new Chess(), false, false);
      await tick();
      assert.ok(update?.error);
      assert.equal(update.busy, false);
      assert.equal(update.evaluations.size, 0);
      session.dispose();
    }
    let recovered: ArenaAnalysisUpdate | undefined;
    const session = new ArenaAnalysisSession(
      async () => score(),
      (value) => {
        recovered = value;
      }
    );
    session.update(new Chess(), false, false);
    await tick();
    assert.equal(recovered?.error, undefined);
    assert.equal(recovered?.evaluations.size, 1);
    session.dispose();
  });
});

describe("arena history and terminal scores", () => {
  it("grades both colors with the shared opening classifications", () => {
    const game = gameWith("e4", "e5");
    const history = game.history({ verbose: true });
    const cache = new Map(
      history.flatMap(
        (move) =>
          [
            [move.before, score()],
            [move.after, score()],
          ] as [string, PositionEval][]
      )
    );
    const projection = projectArenaAnalysis(game, cache, true);
    assert.deepEqual(
      projection.moves.map((move) => move.after?.moveClassification),
      [MoveClassification.Opening, MoveClassification.Opening]
    );
    assert.equal(projection.position.lastMove?.color, "b");
    assert.equal(projection.position.lastEval, cache.get(history[1].before));
  });

  it("rates an actual losing manual move for White and Black from White-perspective scores", () => {
    for (const color of ["w", "b"] as const) {
      const game = new Chess(`4k3/8/8/8/8/8/1R6/4K3 ${color} - - 0 42`);
      const move = game.move(color === "w" ? "Rb3" : "Kd7");
      const cache = new Map([
        [move.before, score(0)],
        [move.after, score(color === "w" ? -900 : 900)],
      ]);
      const projection = projectArenaAnalysis(game, cache, true);
      assert.equal(
        projection.position.eval?.moveClassification,
        MoveClassification.Blunder
      );
      assert.equal(projection.moves[0].move.color, color);
      assert.equal(projection.moves[0].move.before.split(" ")[5], "42");
    }
  });

  it("removes classifications when disabled and leaves uncached current positions unknown", () => {
    const game = gameWith("e4");
    const move = game.history({ verbose: true })[0];
    const cache = new Map([
      [move.before, score()],
      [move.after, score(25)],
    ]);
    assert.equal(
      projectArenaAnalysis(game, cache, false).position.eval
        ?.moveClassification,
      undefined
    );
    assert.equal(
      projectArenaAnalysis(gameWith("e4", "e5"), cache, true).position.eval,
      undefined
    );
  });

  it("keeps promotion identity and the correct raw evaluations", () => {
    const game = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
    const move = game.move({ from: "a7", to: "a8", promotion: "q" });
    const before = score(900, "a7a8q");
    const after = score(900, "h8h7");
    const projection = projectArenaAnalysis(
      game,
      new Map([
        [move.before, before],
        [move.after, after],
      ]),
      true
    );
    assert.equal(projection.moves[0].move.lan, "a7a8q");
    assert.equal(projection.position.lastEval?.bestMove, "a7a8q");
    assert.equal(
      projection.position.eval?.moveClassification,
      MoveClassification.Best
    );
  });

  it("uses checkmate scores for either winner and drawn outcomes without searching", async () => {
    const blackWins = gameWith("f3", "e5", "g4", "Qh4#");
    const whiteWins = gameWith("e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#");
    assert.equal(arenaTerminalEval(blackWins)?.lines[0].mate, -1);
    assert.equal(arenaTerminalEval(whiteWins)?.lines[0].mate, 1);
    const stalemate = new Chess("7k/5K2/6Q1/8/8/8/8/8 b - - 0 1");
    const insufficient = new Chess("7k/8/8/8/8/8/8/K7 w - - 0 1");
    const fiftyMoves = new Chess("7k/8/8/8/8/8/1R6/K7 w - - 100 51");
    for (const game of [
      blackWins,
      whiteWins,
      stalemate,
      insufficient,
      fiftyMoves,
    ]) {
      let calls = 0;
      const session = new ArenaAnalysisSession(
        async () => {
          calls++;
          return score();
        },
        () => {}
      );
      session.update(game, false, false);
      await tick();
      assert.equal(calls, 0);
      assert.ok(projectArenaAnalysis(game, new Map(), false).position.eval);
      session.dispose();
    }
    assert.equal(arenaTerminalEval(stalemate)?.lines[0].cp, 0);
    assert.equal(arenaTerminalEval(insufficient)?.lines[0].cp, 0);
    assert.equal(arenaTerminalEval(fiftyMoves)?.lines[0].cp, 0);
  });

  it("recognizes full-game repetition without poisoning an identical-FEN non-draw cache", () => {
    const game = gameWith(
      "Nf3",
      "Nf6",
      "Ng1",
      "Ng8",
      "Nf3",
      "Nf6",
      "Ng1",
      "Ng8"
    );
    assert.equal(game.isThreefoldRepetition(), true);
    const cache = new Map([[game.fen(), score(40)]]);
    assert.equal(
      projectArenaAnalysis(game, cache, false).position.eval?.lines[0].cp,
      0
    );
    const sameFenWithoutHistory = new Chess(game.fen());
    assert.equal(
      projectArenaAnalysis(sameFenWithoutHistory, cache, false).position.eval
        ?.lines[0].cp,
      40
    );
    assert.equal(cache.get(game.fen())?.lines[0].cp, 40);
  });
});
