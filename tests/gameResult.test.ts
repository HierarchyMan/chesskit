import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { Color } from "@/types/enums";
import {
  getGameResult,
  getOutcomeFor,
  hasMatingMaterial,
} from "@/lib/gameResult";

const play = (...moves: string[]) => {
  const game = new Chess();
  moves.forEach((move) => game.move(move));
  return game;
};

describe("getGameResult", () => {
  it("is still running for a normal position", () => {
    assert.equal(getGameResult(new Chess(), null).over, false);
  });

  it("detects checkmate and the winner", () => {
    const game = play("f3", "e5", "g4", "Qh4#");
    const info = getGameResult(game, null);
    assert.equal(info.over, true);
    assert.equal(info.winner, Color.Black);
    assert.equal(info.result, "0-1");
    assert.equal(info.reason, "Checkmate");
  });

  it("detects stalemate", () => {
    const game = new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    assert.equal(getGameResult(game, null).reason, "Stalemate");
  });

  it("scores resignation for the other side", () => {
    const info = getGameResult(new Chess(), {
      type: "resign",
      loser: Color.White,
    });
    assert.equal(info.winner, Color.Black);
    assert.equal(info.result, "0-1");
  });

  it("scores an agreed draw", () => {
    const info = getGameResult(new Chess(), { type: "draw-agreed" });
    assert.equal(info.result, "1/2-1/2");
    assert.equal(info.winner, undefined);
  });

  it("gives the win on time when the opponent can mate", () => {
    const info = getGameResult(new Chess(), {
      type: "timeout",
      loser: Color.Black,
    });
    assert.equal(info.winner, Color.White);
  });

  it("draws on time when the opponent has only a bare king", () => {
    const game = new Chess("8/8/8/4k3/8/8/4K3/4R3 w - - 0 1");
    const info = getGameResult(game, { type: "timeout", loser: Color.White });
    assert.equal(info.result, "1/2-1/2");
  });
});

describe("hasMatingMaterial", () => {
  it("counts pawns, rooks and queens", () => {
    assert.equal(
      hasMatingMaterial(new Chess("8/8/8/4k3/8/8/4K2P/8 w - - 0 1"), "w"),
      true
    );
    assert.equal(
      hasMatingMaterial(new Chess("8/8/8/4k3/8/8/4K3/8 w - - 0 1"), "w"),
      false
    );
  });

  it("needs more than one lone minor piece", () => {
    assert.equal(
      hasMatingMaterial(new Chess("8/8/8/4k3/8/8/4K1N1/8 w - - 0 1"), "w"),
      false
    );
    assert.equal(
      hasMatingMaterial(new Chess("8/8/8/4k3/8/8/4K1NN/8 w - - 0 1"), "w"),
      true
    );
  });
});

describe("getOutcomeFor", () => {
  it("maps results to the player's point of view", () => {
    const whiteWins = getGameResult(new Chess(), {
      type: "resign",
      loser: Color.Black,
    });
    assert.equal(getOutcomeFor(whiteWins, Color.White), "won");
    assert.equal(getOutcomeFor(whiteWins, Color.Black), "lost");
    const draw = getGameResult(new Chess(), { type: "draw-agreed" });
    assert.equal(getOutcomeFor(draw, Color.White), "drawn");
  });
});
