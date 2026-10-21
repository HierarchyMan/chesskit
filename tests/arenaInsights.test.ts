import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { openings } from "@/data/openings";
import {
  getArenaAccuracy,
  getArenaOpening,
  projectArenaAnalysis,
} from "@/lib/engine/arenaAnalysis";
import { PositionEval } from "@/types/eval";

const evaluation = (cp: number): PositionEval => ({
  bestMove: "e2e4",
  lines: [{ cp, depth: 12, multiPv: 1, pv: ["e2e4"] }],
});

const playGame = (...moves: string[]) => {
  const game = new Chess();
  moves.forEach((move) => game.move(move));
  return game;
};

// Evaluates the start and every resulting position, in order, from cpByPly.
const projectWithScores = (game: Chess, cpByPly: number[]) => {
  const history = game.history({ verbose: true });
  const fens = [history[0].before, ...history.map((move) => move.after)];
  const evaluations = new Map(
    fens.map((fen, index) => [fen, evaluation(cpByPly[index] ?? 0)])
  );
  return projectArenaAnalysis(game, evaluations, false).moves;
};

describe("arena accuracy", () => {
  it("is undefined while any position from the start is still pending", () => {
    const game = playGame("e4", "e5", "Nf3");
    const history = game.history({ verbose: true });
    const evaluations = new Map([
      [history[0].before, evaluation(0)],
      [history[0].after, evaluation(0)],
      // history[1].after is missing, so the series has a gap.
      [history[2].after, evaluation(0)],
    ]);
    const moves = projectArenaAnalysis(game, evaluations, false).moves;

    assert.equal(getArenaAccuracy(moves), undefined);
  });

  it("is undefined before any move exists", () => {
    assert.equal(getArenaAccuracy([]), undefined);
  });

  it("scores a side that gave away advantage below the side that did not", () => {
    // Black's first move, e5, turns a level game into a White advantage.
    const game = playGame("e4", "e5", "Nf3", "Nc6");
    const moves = projectWithScores(game, [0, 0, 400, 400, 400]);
    const accuracy = getArenaAccuracy(moves);

    assert.ok(accuracy);
    assert.ok(Math.abs((accuracy.white ?? 0) - 100) < 1e-9);
    assert.ok(accuracy.black !== null && accuracy.black < 100);
  });

  it("reports null for a side that has not moved yet", () => {
    const game = playGame("e4");
    const moves = projectWithScores(game, [0, 0]);
    const accuracy = getArenaAccuracy(moves);

    assert.ok(accuracy);
    assert.equal(accuracy.black, null);
  });

  it("attributes moves correctly when the match starts with Black to move", () => {
    const game = new Chess(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    );
    game.move("c5");
    game.move("Nf3");
    game.move("d6");
    const history = game.history({ verbose: true });
    assert.equal(history[0].color, "b");
    // Black's c5 hands White an advantage; the later moves change nothing.
    const evaluations = new Map([
      [history[0].before, evaluation(0)],
      [history[0].after, evaluation(400)],
      [history[1].after, evaluation(400)],
      [history[2].after, evaluation(400)],
    ]);
    const moves = projectArenaAnalysis(game, evaluations, false).moves;
    const accuracy = getArenaAccuracy(moves);

    assert.ok(accuracy);
    assert.ok(Math.abs(accuracy.white! - 100) < 1e-9);
    assert.ok(accuracy.black !== null && accuracy.black < 100);
  });
});

describe("arena opening name", () => {
  it("names the most recent book position reached", () => {
    const game = playGame("e4", "e5", "Nf3", "Nc6", "Bc4");
    const moves = projectWithScores(game, []);

    assert.equal(getArenaOpening(moves), "Italian Game");
  });

  it("uses the last book position when play has left the book", () => {
    const game = playGame("e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "h3");
    const moves = projectWithScores(game, []);
    const placement = game.fen().split(" ")[0];
    assert.ok(!openings.some((opening) => opening.fen === placement));

    assert.equal(getArenaOpening(moves), "Italian Game: Giuoco Piano");
  });

  it("is undefined when no reached position is a book position", () => {
    // A custom start that no opening reaches, as the arena allows from a FEN.
    const game = new Chess("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    game.move("Kd2");
    game.move("Kd7");
    const moves = projectWithScores(game, []);
    const placements = moves.map((move) => move.move.after.split(" ")[0]);
    assert.ok(!placements.some((p) => openings.some((o) => o.fen === p)));

    assert.equal(getArenaOpening(moves), undefined);
  });
});
