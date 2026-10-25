import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { projectPlayFeedback } from "@/lib/playFeedback";
import {
  ArenaAnalysisSession,
  ArenaAnalysisUpdate,
} from "@/lib/engine/arenaAnalysis";
import { PositionEval } from "@/types/eval";
import { getCapturedPieces } from "@/lib/chess";
import { Color } from "@/types/enums";

const engine = {};
const gameWith = (...moves: string[]) => {
  const game = new Chess();
  moves.forEach((move) => game.move(move));
  return game;
};
const score = (fen: string): PositionEval => ({
  lines: [
    {
      cp: 20,
      depth: 12,
      multiPv: 1,
      pv: [new Chess(fen).moves({ verbose: true })[0]?.lan].filter(Boolean),
    },
  ],
});

describe("captured material belongs to the actual game history", () => {
  const captured = (game: Chess, side: Color) =>
    getCapturedPieces(game, side).filter((entry) => entry.count > 0);

  it("does not count missing custom-root pieces as captures and follows takeback", () => {
    const game = new Chess("4k2r/8/8/8/8/8/8/3QK3 w - - 0 1");
    assert.deepEqual(captured(game, Color.White), []);
    assert.deepEqual(captured(game, Color.Black), []);
    game.move("Qh5+");
    game.move("Rxh5");
    assert.deepEqual(captured(game, Color.Black), [{ piece: "wQ", count: 1 }]);
    assert.deepEqual(captured(game, Color.White), []);
    game.undo();
    assert.deepEqual(captured(game, Color.Black), []);
  });

  it("counts en passant and does not turn a promotion into a captured pawn", () => {
    const game = gameWith("e4", "a6", "e5", "d5", "exd6");
    assert.deepEqual(captured(game, Color.White), [{ piece: "bP", count: 1 }]);
    const promotion = new Chess("4k2r/6P1/8/8/8/8/8/4K3 w - - 0 1");
    promotion.move("gxh8=Q+");
    assert.deepEqual(captured(promotion, Color.White), [
      { piece: "bR", count: 1 },
    ]);
    assert.deepEqual(captured(promotion, Color.Black), []);
  });
});
const evaluationsFor = (game: Chess) =>
  new Map(
    game
      .history({ verbose: true })
      .flatMap((move) => [move.before, move.after])
      .map((fen) => [fen, score(fen)])
  );
const project = (game: Chess, evaluations = evaluationsFor(game)) =>
  projectPlayFeedback({
    game,
    gameId: 1,
    player: "w",
    enabled: true,
    engine,
    snapshot: { gameId: 1, source: engine, evaluations },
  });

describe("Play board and coach share evaluated moves", () => {
  it("finishes the board's grade for the bot reply while the coach still describes the human move", () => {
    const game = gameWith("e4", "e5");
    const result = project(game);
    assert.equal(result.position.lastMove?.san, "e5");
    assert.ok(result.position.eval?.moveClassification);
    assert.equal(result.feedback?.playedSan, "e4");
    assert.equal(result.feedback?.status, "done");
    assert.ok(result.moves.every((entry) => entry.after?.moveClassification));
  });

  it("grades either player's colour and preserves a Black custom root's move index", () => {
    const game = new Chess("4k3/8/8/8/8/8/1R6/4K3 b - - 17 42");
    game.move("Kd7");
    const result = projectPlayFeedback({
      game,
      gameId: 7,
      player: "b",
      enabled: true,
      engine,
      snapshot: {
        gameId: 7,
        source: engine,
        evaluations: evaluationsFor(game),
      },
    });
    assert.equal(result.playerMoveIndex, 0);
    assert.equal(result.feedback?.status, "done");
    assert.equal(result.position.lastMove?.color, "b");
    assert.ok(result.position.eval?.moveClassification);
  });

  it("does not show a permanent pending marker when coaching is off or evaluation fails", () => {
    const game = gameWith("e4");
    const base = { game, gameId: 1, player: "w" as const, engine };
    const off = projectPlayFeedback({ ...base, enabled: false });
    assert.equal(off.position.lastMove, undefined);
    assert.equal(off.feedback, undefined);
    assert.deepEqual(off.moves, []);
    const failed = projectPlayFeedback({
      ...base,
      enabled: true,
      error: "Engine failed",
    });
    assert.equal(failed.position.lastMove, undefined);
    assert.equal(failed.feedback?.status, "error");
    const pending = projectPlayFeedback({ ...base, enabled: true });
    assert.equal(pending.position.lastMove?.san, "e4");
    assert.equal(pending.feedback?.status, "evaluating");
  });

  it("rejects previous-game and previous-engine evaluations before effects run", () => {
    const game = gameWith("e4", "e5");
    const snapshot = {
      gameId: 1,
      source: engine,
      evaluations: evaluationsFor(game),
    };
    for (const owner of [
      { gameId: 2, engine },
      { gameId: 1, engine: {} },
    ]) {
      const result = projectPlayFeedback({
        game,
        player: "w",
        enabled: true,
        snapshot,
        ...owner,
      });
      assert.equal(result.position.eval, undefined);
      assert.equal(result.feedback?.status, "evaluating");
    }
    const first = project(game).feedback!;
    const next = projectPlayFeedback({
      game,
      gameId: 2,
      player: "w",
      enabled: true,
      engine,
      snapshot: { ...snapshot, gameId: 2 },
    }).feedback!;
    assert.notEqual(first.key, next.key);
  });

  it("projects the takeback path instead of keeping the later move's grade", () => {
    const game = gameWith("e4", "e5", "Nf3", "Nc6");
    const cached = evaluationsFor(game);
    game.undo();
    game.undo();
    const result = project(game, cached);
    assert.equal(result.position.lastMove?.san, "e5");
    assert.equal(result.feedback?.playedSan, "e4");
    assert.equal(result.feedback?.status, "done");
    assert.equal(result.moves.length, 2);
  });

  it("finishes a checkmating move without waiting for an impossible engine search", () => {
    const game = new Chess("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1");
    const before = game.fen();
    game.move("Qg7#");
    const result = project(
      game,
      new Map([
        [before, { lines: [{ mate: 1, depth: 12, multiPv: 1, pv: ["f7g7"] }] }],
      ])
    );
    assert.equal(result.feedback?.status, "done");
    assert.ok(result.position.eval?.moveClassification);
    assert.equal(result.position.eval?.lines[0].mate, 1);
  });

  it("keeps an in-flight human evaluation useful when the bot replies, then grades both moves", async () => {
    const game = gameWith("e4");
    let finish!: () => void;
    let update: ArenaAnalysisUpdate | undefined;
    let first = true;
    const session = new ArenaAnalysisSession(
      async (fen) => {
        if (first) {
          first = false;
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
        }
        return score(fen);
      },
      (value) => {
        update = value;
      }
    );
    session.update(game, true, true);
    const reply = gameWith("e4", "e5");
    session.update(reply, true, true);
    finish();
    await new Promise<void>((resolve) => setImmediate(resolve));
    const result = project(
      reply,
      update!.evaluations as Map<string, PositionEval>
    );
    assert.equal(update?.busy, false);
    assert.equal(result.feedback?.status, "done");
    assert.ok(result.position.eval?.moveClassification);
    session.dispose();
  });
});
