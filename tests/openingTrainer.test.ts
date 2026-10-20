import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { OPENING_LINES } from "@/data/openingLines";
import { loadGameFromText } from "@/lib/pgn";
import {
  buildSteps,
  fenAtPly,
  lineToPgn,
  moveLabel,
} from "@/lib/openingTrainer";

describe("opening lines", () => {
  it("has unique ids and a balanced repertoire", () => {
    assert.equal(
      new Set(OPENING_LINES.map(({ id }) => id)).size,
      OPENING_LINES.length
    );
    assert.ok(OPENING_LINES.filter(({ side }) => side === "w").length >= 5);
    assert.ok(OPENING_LINES.filter(({ side }) => side === "b").length >= 5);
  });

  for (const line of OPENING_LINES) {
    describe(line.id, () => {
      it("is made of legal moves", () => {
        const steps = buildSteps(line);
        assert.ok(steps.length >= 10);
      });

      it("only has notes for plies inside the line", () => {
        const length = line.moves.split(" ").length;
        for (const ply of Object.keys(line.notes).map(Number)) {
          assert.ok(ply >= 0 && ply < length, `note for ply ${ply}`);
        }
      });

      it("explains most of the moves its player makes", () => {
        const steps = buildSteps(line);
        const mine = steps.filter((step) => step.color === line.side);
        const explained = mine.filter((step) => line.notes[step.ply]);
        assert.ok(explained.length >= mine.length - 1);
      });

      it("finishes on a move that keeps the game going", () => {
        const game = new Chess();
        line.moves.split(" ").forEach((san) => game.move(san));
        assert.equal(game.isGameOver(), false);
      });

      it("round-trips through PGN", () => {
        const steps = buildSteps(line);
        const loaded = loadGameFromText(lineToPgn(line, steps));
        assert.equal(loaded.history().length, steps.length);
        assert.equal(loaded.fen(), steps.at(-1)?.fenAfter);
      });
    });
  }
});

describe("line helpers", () => {
  const steps = buildSteps(OPENING_LINES[0]);

  it("reports the position after a given number of plies", () => {
    assert.equal(fenAtPly(steps, 0), new Chess().fen());
    assert.equal(fenAtPly(steps, 1), steps[0].fenAfter);
    assert.equal(fenAtPly(steps, 999), steps.at(-1)?.fenAfter);
  });

  it("labels moves the way they are written in a score sheet", () => {
    assert.equal(moveLabel(steps[0]), "1. e4");
    assert.equal(moveLabel(steps[1]), "1... e5");
    assert.equal(moveLabel(steps[4]), "3. Bc4");
  });

  it("records the first move as UCI", () => {
    assert.equal(steps[0].uci, "e2e4");
    assert.equal(steps[0].color, "w");
  });
});
