import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { Color } from "@/types/enums";
import {
  ENDGAMES,
  ENDGAME_LEVELS,
  evaluateChallenge,
  getEndgame,
} from "@/lib/endgames";
import { GameResultInfo } from "@/lib/gameResult";

const ongoing: GameResultInfo = { over: false, result: "*", reason: "" };
const won = (winner: Color): GameResultInfo => ({
  over: true,
  winner,
  result: winner === Color.White ? "1-0" : "0-1",
  reason: "Checkmate",
});
const drawn: GameResultInfo = {
  over: true,
  result: "1/2-1/2",
  reason: "Stalemate",
};

describe("endgame positions", () => {
  it("has unique ids and known levels", () => {
    assert.equal(
      new Set(ENDGAMES.map(({ id }) => id)).size,
      ENDGAMES.length
    );
    for (const endgame of ENDGAMES) {
      assert.ok(ENDGAME_LEVELS.includes(endgame.level), endgame.id);
      assert.ok(endgame.tips.length >= 2, endgame.id);
    }
  });

  for (const endgame of ENDGAMES) {
    it(`${endgame.id} is a legal position that is not over`, () => {
      const game = new Chess(endgame.fen);
      assert.equal(game.isGameOver(), false);
      assert.ok(game.moves().length > 0);
    });

    it(`${endgame.id} gives the player something to do`, () => {
      assert.ok(["w", "b"].includes(endgame.player));
      if (endgame.goal === "draw") {
        assert.ok((endgame.holdMoves ?? 0) > 0);
      }
    });
  }

  it("finds an endgame by id", () => {
    assert.equal(getEndgame("lucena")?.title, "The Lucena position");
    assert.equal(getEndgame("nope"), undefined);
  });
});

describe("evaluateChallenge", () => {
  const win = getEndgame("queen-mate")!;
  const hold = getEndgame("philidor")!;

  it("completes a win challenge on the player's checkmate", () => {
    assert.equal(
      evaluateChallenge(win, won(Color.White), Color.White, 20),
      "complete"
    );
  });

  it("fails a win challenge on a draw or a loss", () => {
    assert.equal(evaluateChallenge(win, drawn, Color.White, 20), "failed");
    assert.equal(
      evaluateChallenge(win, won(Color.Black), Color.White, 20),
      "failed"
    );
  });

  it("keeps a win challenge active while the game goes on", () => {
    assert.equal(evaluateChallenge(win, ongoing, Color.White, 80), "active");
  });

  it("completes a draw challenge on a drawn ending", () => {
    assert.equal(evaluateChallenge(hold, drawn, Color.Black, 10), "complete");
  });

  it("completes a draw challenge once the player has held long enough", () => {
    assert.equal(evaluateChallenge(hold, ongoing, Color.Black, 39), "active");
    assert.equal(evaluateChallenge(hold, ongoing, Color.Black, 40), "complete");
  });

  it("fails a draw challenge when the opponent wins, and counts a win as success", () => {
    assert.equal(
      evaluateChallenge(hold, won(Color.White), Color.Black, 30),
      "failed"
    );
    assert.equal(
      evaluateChallenge(hold, won(Color.Black), Color.Black, 30),
      "complete"
    );
  });
});
